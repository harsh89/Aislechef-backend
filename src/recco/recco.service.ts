import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import { ReccoRequestDto } from './dto/recco-request.dto';

const RATE_LIMIT = 10;
const CACHE_TTL_DAYS = 7;

@Injectable()
export class ReccoService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject('OPENAI_CLIENT') private readonly openai: OpenAI,
  ) {}

  async getRecipes(userId: string, dto: ReccoRequestDto) {
    const today = new Date().toISOString().split('T')[0];

    const { data: rateLimit } = await this.supabase.client
      .from('recco_rate_limits')
      .select('requestCount')
      .eq('userId', userId)
      .eq('date', today)
      .single();

    if (rateLimit && (rateLimit.requestCount as number) >= RATE_LIMIT) {
      throw new HttpException('Daily recipe limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    const fingerprint = this.computeFingerprint(
      dto.selectedItems,
      dto.cuisineFilter,
    );

    const { data: cached } = await this.supabase.client
      .from('recipe_cache')
      .select('response')
      .eq('ingredientFingerprint', fingerprint)
      .eq('cuisineFilter', dto.cuisineFilter)
      .gt('expiresAt', new Date().toISOString())
      .single();

    const currentCount = (rateLimit?.requestCount as number) ?? 0;

    if (cached) {
      await this.incrementRateLimit(userId, today, currentCount);
      return { fromCache: true, recipes: cached.response };
    }

    const recipes = await this.callLLM(dto.selectedItems, dto.cuisineFilter);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await this.supabase.client.from('recipe_cache').insert({
      ingredientFingerprint: fingerprint,
      cuisineFilter: dto.cuisineFilter,
      response: recipes,
      expiresAt: expiresAt.toISOString(),
    });

    await this.incrementRateLimit(userId, today, currentCount);
    return { fromCache: false, recipes };
  }

  private computeFingerprint(items: string[], cuisine: string): string {
    const sorted = [...items].sort().join(',');
    return createHash('sha256').update(`${sorted}:${cuisine}`).digest('hex');
  }

  private async incrementRateLimit(
    userId: string,
    date: string,
    currentCount: number,
  ): Promise<void> {
    await this.supabase.client
      .from('recco_rate_limits')
      .upsert(
        { userId, date, requestCount: currentCount + 1 },
        { onConflict: 'userId,date' },
      );
  }

  private async callLLM(items: string[], cuisine: string) {
    const prompt = `You are a recipe assistant. Create exactly 2 ${cuisine} recipes using these ingredients: ${items.join(', ')}.

Return a JSON object with this exact structure:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "ingredients": [{"name": "ingredient", "quantity": 1, "unit": "pcs"}],
      "instructions": ["Step 1: ...", "Step 2: ..."]
    }
  ]
}

The unit must be one of: pcs, kg, g, L, mL, tbsp, tsp, cup.
Return only valid JSON, no other text.`;

    const response = await this.openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      },
      { timeout: 30000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content)
      throw new InternalServerErrorException('LLM returned empty response');

    try {
      const parsed = JSON.parse(content) as { recipes: unknown[] };
      return parsed.recipes;
    } catch {
      throw new InternalServerErrorException('Failed to parse LLM response');
    }
  }
}
