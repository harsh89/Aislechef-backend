import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import { ReccoRequestDto, RecipeModeEnum } from './dto/recco-request.dto';

const RATE_LIMIT = 10;
const CACHE_TTL_DAYS = 7;

// Switch this to 'claude' when you have Anthropic credits
const LLM_PROVIDER: 'claude' | 'openai' = 'openai';

@Injectable()
export class ReccoService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject('ANTHROPIC_CLIENT') private readonly anthropic: Anthropic,
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
      throw new HttpException(
        'Daily recipe limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const fingerprint = this.computeFingerprint(
      dto.selectedItems,
      dto.cuisineFilter,
      dto.recipeMode,
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
      return { fromCache: true, recipes: cached.response as unknown[] };
    }

    const recipes = await this.callLLM(
      dto.selectedItems,
      dto.cuisineFilter,
      dto.recipeMode,
    );

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

  private computeFingerprint(
    items: string[],
    cuisine: string,
    mode: RecipeModeEnum,
  ): string {
    const sorted = [...items].sort().join(',');
    return createHash('sha256')
      .update(`${sorted}:${cuisine}:${mode}`)
      .digest('hex');
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

  private buildPrompt(
    items: string[],
    cuisine: string,
    mode: RecipeModeEnum,
  ): string {
    const modeInstruction =
      mode === RecipeModeEnum.EXACT
        ? `Build the recipes using primarily these ingredients: ${items.join(', ')}. You may add basic cooking essentials (salt, pepper, oil, water) only if absolutely necessary — do not introduce any other ingredients.`
        : `The user has these ingredients: ${items.join(', ')}. Create complete, authentic ${cuisine} recipes that use these as the core. Add whatever additional ingredients are needed to make a proper, well-rounded dish — including spices, aromatics, sauces, and garnishes typical of ${cuisine} cuisine.`;

    return `You are an expert ${cuisine} chef and recipe writer. Create exactly 2 distinct, authentic ${cuisine} recipes.

${modeInstruction}

Requirements for each recipe:
- Instructions must be detailed and actionable: include prep steps, cooking temperatures, timings, and visual cues (e.g. "cook on medium heat for 5 minutes until onions turn golden")
- Each recipe must have at least 5 instruction steps
- Quantities must be realistic for 2 servings
- Recipes must be genuinely different from each other (not variations of the same dish)

Return a JSON object with this exact structure:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "servings": 2,
      "prepTime": "10 mins",
      "cookTime": "20 mins",
      "ingredients": [{"name": "ingredient", "quantity": 1, "unit": "pcs"}],
      "instructions": [
        "Step 1: Detailed action with time/temperature if applicable.",
        "Step 2: ..."
      ]
    }
  ]
}

The unit must be one of: pcs, kg, g, L, mL, tbsp, tsp, cup.
Return only valid JSON, no other text.`;
  }

  private callLLM(items: string[], cuisine: string, mode: RecipeModeEnum) {
    if (LLM_PROVIDER === 'openai') {
      return this.callLLMOpenAI(items, cuisine, mode);
    }
    return this.callLLMClaude(items, cuisine, mode);
  }

  private async callLLMClaude(
    items: string[],
    cuisine: string,
    mode: RecipeModeEnum,
  ) {
    const prompt = this.buildPrompt(items, cuisine, mode);

    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text' || !block.text) {
      throw new InternalServerErrorException('LLM returned empty response');
    }

    try {
      const parsed = JSON.parse(block.text) as { recipes: unknown[] };
      return parsed.recipes;
    } catch {
      throw new InternalServerErrorException('Failed to parse LLM response');
    }
  }

  private async callLLMOpenAI(
    items: string[],
    cuisine: string,
    mode: RecipeModeEnum,
  ) {
    const prompt = this.buildPrompt(items, cuisine, mode);

    const response = await this.openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      },
      { timeout: 30000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException('LLM returned empty response');
    }

    try {
      const parsed = JSON.parse(content) as { recipes: unknown[] };
      return parsed.recipes;
    } catch {
      throw new InternalServerErrorException('Failed to parse LLM response');
    }
  }
}
