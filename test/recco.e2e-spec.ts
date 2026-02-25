import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';
import {
  createMockSupabaseService,
  mockChain,
  TEST_TOKEN,
} from './helpers/mock-supabase.factory';

const FAKE_RECIPES = [
  {
    name: 'Dal Tadka',
    ingredients: [{ name: 'lentils', quantity: 1, unit: 'cup' }],
    instructions: ['Step 1: boil lentils'],
  },
];

const mockChatCreate = jest.fn();
const mockOpenAI = { chat: { completions: { create: mockChatCreate } } };

describe('Recco (e2e)', () => {
  let app: INestApplication;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  const auth = { Authorization: `Bearer ${TEST_TOKEN}` };

  beforeEach(async () => {
    supabase = createMockSupabaseService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(supabase)
      .overrideProvider('OPENAI_CLIENT')
      .useValue(mockOpenAI)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  const validBody = {
    selectedItems: ['tomato', 'onion'],
    cuisineFilter: 'Indian',
  };

  it('POST /recco → 201 with fromCache: false on cache miss', async () => {
    supabase.client.from
      .mockReturnValueOnce(mockChain({ data: null, error: null })) // rate limit: no record
      .mockReturnValueOnce(mockChain({ data: null, error: null })) // cache miss
      .mockReturnValueOnce(mockChain({ data: {}, error: null })) // cache insert
      .mockReturnValueOnce(mockChain({ data: {}, error: null })); // rate limit upsert

    mockChatCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ recipes: FAKE_RECIPES }) } },
      ],
    });

    return request(app.getHttpServer())
      .post('/recco')
      .set(auth)
      .send(validBody)
      .expect(201)
      .expect((res) => {
        expect(res.body.fromCache).toBe(false);
        expect(Array.isArray(res.body.recipes)).toBe(true);
      });
  });

  it('POST /recco → 201 with fromCache: true on cache hit', async () => {
    supabase.client.from
      .mockReturnValueOnce(
        mockChain({ data: { requestCount: 0 }, error: null }),
      ) // rate limit
      .mockReturnValueOnce(
        mockChain({ data: { response: FAKE_RECIPES }, error: null }),
      ) // cache hit
      .mockReturnValueOnce(mockChain({ data: {}, error: null })); // rate limit upsert

    return request(app.getHttpServer())
      .post('/recco')
      .set(auth)
      .send(validBody)
      .expect(201)
      .expect((res) => {
        expect(res.body.fromCache).toBe(true);
        expect(mockChatCreate).not.toHaveBeenCalled();
      });
  });

  it('POST /recco → 429 when rate limit is reached', async () => {
    supabase.client.from.mockReturnValue(
      mockChain({ data: { requestCount: 10 }, error: null }),
    );

    return request(app.getHttpServer())
      .post('/recco')
      .set(auth)
      .send(validBody)
      .expect(429);
  });

  it('POST /recco → 400 with invalid cuisineFilter', () => {
    return request(app.getHttpServer())
      .post('/recco')
      .set(auth)
      .send({ selectedItems: ['tomato'], cuisineFilter: 'Japanese' })
      .expect(400);
  });

  it('POST /recco → 400 when selectedItems is not an array', () => {
    return request(app.getHttpServer())
      .post('/recco')
      .set(auth)
      .send({ selectedItems: 'tomato', cuisineFilter: 'Indian' })
      .expect(400);
  });

  it('POST /recco → 401 without auth token', () => {
    return request(app.getHttpServer())
      .post('/recco')
      .send(validBody)
      .expect(401);
  });
});
