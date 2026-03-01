import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { CuisineEnum, RecipeModeEnum } from './dto/recco-request.dto';
import { ReccoService } from './recco.service';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'upsert', 'eq', 'gt']) {
    c[m] = jest.fn().mockReturnThis();
  }
  c['single'] = jest.fn().mockResolvedValue(result);
  (
    c as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }
  ).then = (resolve) => Promise.resolve(result).then(resolve);
  return c;
}

const mockFrom = jest.fn();
const mockSupabaseService = { client: { from: mockFrom } };

const mockChatCreate = jest.fn();
const mockOpenAI = { chat: { completions: { create: mockChatCreate } } };

const DTO = {
  selectedItems: ['tomato', 'onion'],
  cuisineFilter: CuisineEnum.INDIAN,
  recipeMode: RecipeModeEnum.EXACT,
};
const FAKE_RECIPES = [{ name: 'Dal Tadka', ingredients: [], instructions: [] }];

const LLM_RESPONSE = {
  choices: [
    { message: { content: JSON.stringify({ recipes: FAKE_RECIPES }) } },
  ],
};

describe('ReccoService', () => {
  let service: ReccoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReccoService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: 'OPENAI_CLIENT', useValue: mockOpenAI },
        { provide: 'ANTHROPIC_CLIENT', useValue: {} },
      ],
    }).compile();
    service = module.get<ReccoService>(ReccoService);
    jest.clearAllMocks();
  });

  describe('rate limiting', () => {
    it('throws TooManyRequestsException when limit is reached', async () => {
      const rateLimitChain = chain({ data: { requestCount: 10 }, error: null });
      mockFrom.mockReturnValue(rateLimitChain);

      await expect(service.getRecipes('u1', DTO)).rejects.toThrow(HttpException);
      expect(mockChatCreate).not.toHaveBeenCalled();
    });

    it('allows the request when count is below limit', async () => {
      const rateLimitChain = chain({ data: { requestCount: 9 }, error: null });
      const cacheChain = chain({ data: null, error: null });
      const insertChain = chain({ data: {}, error: null });
      const upsertChain = chain({ data: {}, error: null });

      mockFrom
        .mockReturnValueOnce(rateLimitChain) // rate limit check
        .mockReturnValueOnce(cacheChain) // cache miss
        .mockReturnValueOnce(insertChain) // cache insert
        .mockReturnValueOnce(upsertChain); // rate limit upsert

      mockChatCreate.mockResolvedValue(LLM_RESPONSE);

      const result = await service.getRecipes('u1', DTO);
      expect(result.fromCache).toBe(false);
    });

    it('allows request when no rate limit record exists', async () => {
      const rateLimitChain = chain({ data: null, error: null });
      const cacheChain = chain({ data: null, error: null });
      const insertChain = chain({ data: {}, error: null });
      const upsertChain = chain({ data: {}, error: null });

      mockFrom
        .mockReturnValueOnce(rateLimitChain)
        .mockReturnValueOnce(cacheChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(upsertChain);

      mockChatCreate.mockResolvedValue(LLM_RESPONSE);

      await expect(service.getRecipes('u1', DTO)).resolves.not.toThrow();
    });
  });

  describe('cache', () => {
    it('returns fromCache: true and skips LLM on cache hit', async () => {
      const rateLimitChain = chain({ data: { requestCount: 0 }, error: null });
      const cacheChain = chain({
        data: { response: FAKE_RECIPES },
        error: null,
      });
      const upsertChain = chain({ data: {}, error: null });

      mockFrom
        .mockReturnValueOnce(rateLimitChain)
        .mockReturnValueOnce(cacheChain)
        .mockReturnValueOnce(upsertChain);

      const result = await service.getRecipes('u1', DTO);

      expect(result.fromCache).toBe(true);
      expect(result.recipes).toEqual(FAKE_RECIPES);
      expect(mockChatCreate).not.toHaveBeenCalled();
    });

    it('calls LLM and stores result on cache miss', async () => {
      const rateLimitChain = chain({ data: null, error: null });
      const cacheChain = chain({ data: null, error: null });
      const insertChain = chain({ data: {}, error: null });
      const upsertChain = chain({ data: {}, error: null });

      mockFrom
        .mockReturnValueOnce(rateLimitChain)
        .mockReturnValueOnce(cacheChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(upsertChain);

      mockChatCreate.mockResolvedValue(LLM_RESPONSE);

      const result = await service.getRecipes('u1', DTO);

      expect(result.fromCache).toBe(false);
      expect(result.recipes).toEqual(FAKE_RECIPES);
      expect(mockChatCreate).toHaveBeenCalledTimes(1);
      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ cuisineFilter: 'Indian' }),
      );
    });

    it('produces identical fingerprints regardless of item order', async () => {
      const dto1 = {
        selectedItems: ['onion', 'tomato'],
        cuisineFilter: CuisineEnum.INDIAN,
        recipeMode: RecipeModeEnum.EXACT,
      };
      const dto2 = {
        selectedItems: ['tomato', 'onion'],
        cuisineFilter: CuisineEnum.INDIAN,
        recipeMode: RecipeModeEnum.EXACT,
      };

      // Both should produce same fingerprint — test via cache behaviour
      const rateLimitChain1 = chain({ data: null, error: null });
      const cacheChain1 = chain({ data: null, error: null });
      const insertChain1 = chain({ data: {}, error: null });
      const upsertChain1 = chain({ data: {}, error: null });

      const rateLimitChain2 = chain({ data: null, error: null });
      const cacheChain2 = chain({ data: null, error: null });
      const insertChain2 = chain({ data: {}, error: null });
      const upsertChain2 = chain({ data: {}, error: null });

      mockFrom
        .mockReturnValueOnce(rateLimitChain1)
        .mockReturnValueOnce(cacheChain1)
        .mockReturnValueOnce(insertChain1)
        .mockReturnValueOnce(upsertChain1)
        .mockReturnValueOnce(rateLimitChain2)
        .mockReturnValueOnce(cacheChain2)
        .mockReturnValueOnce(insertChain2)
        .mockReturnValueOnce(upsertChain2);

      mockChatCreate.mockResolvedValue(LLM_RESPONSE);

      await service.getRecipes('u1', dto1);
      await service.getRecipes('u1', dto2);

      // Both inserts should use the same fingerprint
      const fp1 = insertChain1['insert'].mock.calls[0][0]
        .ingredientFingerprint as string;
      const fp2 = insertChain2['insert'].mock.calls[0][0]
        .ingredientFingerprint as string;
      expect(fp1).toBe(fp2);
    });
  });

  describe('LLM errors', () => {
    it('throws InternalServerErrorException when LLM returns empty content', async () => {
      const rateLimitChain = chain({ data: null, error: null });
      const cacheChain = chain({ data: null, error: null });
      mockFrom
        .mockReturnValueOnce(rateLimitChain)
        .mockReturnValueOnce(cacheChain);

      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(service.getRecipes('u1', DTO)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException when LLM returns invalid JSON', async () => {
      const rateLimitChain = chain({ data: null, error: null });
      const cacheChain = chain({ data: null, error: null });
      mockFrom
        .mockReturnValueOnce(rateLimitChain)
        .mockReturnValueOnce(cacheChain);

      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'not-json' } }],
      });

      await expect(service.getRecipes('u1', DTO)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('propagates LLM timeout error', async () => {
      const rateLimitChain = chain({ data: null, error: null });
      const cacheChain = chain({ data: null, error: null });
      mockFrom
        .mockReturnValueOnce(rateLimitChain)
        .mockReturnValueOnce(cacheChain);

      mockChatCreate.mockRejectedValue(new Error('Request timed out'));

      await expect(service.getRecipes('u1', DTO)).rejects.toThrow(
        'Request timed out',
      );
    });
  });
});
