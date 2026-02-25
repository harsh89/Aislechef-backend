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

describe('Lists (e2e)', () => {
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
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /lists → 201 with valid body', async () => {
    const newList = { listId: 'l1', name: 'Groceries', userId: 'user-test-id' };
    supabase.client.from.mockReturnValue(
      mockChain({ data: newList, error: null }),
    );

    return request(app.getHttpServer())
      .post('/lists')
      .set(auth)
      .send({ name: 'Groceries' })
      .expect(201)
      .expect((res) => {
        expect(res.body.name).toBe('Groceries');
      });
  });

  it('POST /lists → 400 when name is missing', () => {
    return request(app.getHttpServer())
      .post('/lists')
      .set(auth)
      .send({})
      .expect(400);
  });

  it('POST /lists → 400 when extra fields are sent', () => {
    return request(app.getHttpServer())
      .post('/lists')
      .set(auth)
      .send({ name: 'Valid', extraField: 'banned' })
      .expect(400);
  });

  it('GET /lists → 200 with array of lists', async () => {
    supabase.client.from.mockReturnValue(
      mockChain({ data: [{ listId: 'l1' }, { listId: 'l2' }], error: null }),
    );

    return request(app.getHttpServer())
      .get('/lists')
      .set(auth)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('GET /lists/:listId → 200 with list and items', async () => {
    const listData = { listId: 'l1', name: 'Groceries' };
    const itemsData = [{ itemId: 'i1' }];
    supabase.client.from
      .mockReturnValueOnce(mockChain({ data: listData, error: null }))
      .mockReturnValueOnce(mockChain({ data: itemsData, error: null }));

    return request(app.getHttpServer())
      .get('/lists/l1')
      .set(auth)
      .expect(200)
      .expect((res) => {
        expect(res.body.listId).toBe('l1');
        expect(Array.isArray(res.body.items)).toBe(true);
      });
  });

  it('GET /lists/:listId → 404 when list not found', async () => {
    supabase.client.from.mockReturnValue(
      mockChain({ data: null, error: { message: 'PGRST116' } }),
    );

    return request(app.getHttpServer())
      .get('/lists/non-existent')
      .set(auth)
      .expect(404);
  });

  it('GET /lists/:listId?page=2&limit=5 → passes pagination to service', async () => {
    const listData = { listId: 'l1' };
    const listChain = mockChain({ data: listData, error: null });
    const itemsChain = mockChain({ data: [], error: null });
    supabase.client.from
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(itemsChain);

    await request(app.getHttpServer())
      .get('/lists/l1?page=2&limit=5')
      .set(auth)
      .expect(200);

    expect(itemsChain['range']).toHaveBeenCalledWith(5, 9);
  });

  it('PUT /lists/:listId → 200 with updated list', async () => {
    const updated = { listId: 'l1', name: 'Updated' };
    supabase.client.from.mockReturnValue(
      mockChain({ data: updated, error: null }),
    );

    return request(app.getHttpServer())
      .put('/lists/l1')
      .set(auth)
      .send({ name: 'Updated' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Updated');
      });
  });

  it('DELETE /lists/:listId → 204', async () => {
    supabase.client.from
      .mockReturnValueOnce(mockChain({ data: {}, error: null }))
      .mockReturnValueOnce(mockChain({ data: {}, error: null }));

    return request(app.getHttpServer())
      .delete('/lists/l1')
      .set(auth)
      .expect(204);
  });

  it('GET /lists/:listId/search?q=milk → 200 with matching items', async () => {
    supabase.client.from
      .mockReturnValueOnce(mockChain({ data: { listId: 'l1' }, error: null }))
      .mockReturnValueOnce(
        mockChain({ data: [{ itemId: 'i1', itemName: 'Milk' }], error: null }),
      );

    return request(app.getHttpServer())
      .get('/lists/l1/search?q=milk')
      .set(auth)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('GET /lists/:listId/search → 404 when list not found', async () => {
    supabase.client.from.mockReturnValue(
      mockChain({ data: null, error: null }),
    );

    return request(app.getHttpServer())
      .get('/lists/missing/search?q=x')
      .set(auth)
      .expect(404);
  });
});
