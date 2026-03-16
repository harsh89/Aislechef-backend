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

describe('Items (e2e)', () => {
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

  const validItem = { itemName: 'Milk', quantity: 2, unit: 'L' };

  it('POST /lists/:listId/items → 201 with valid body (new item)', async () => {
    const listChain = mockChain({ data: { listId: 'l1' }, error: null });
    const lookupChain = mockChain({ data: null, error: null });
    const insertChain = mockChain({
      data: { itemId: 'i1', ...validItem },
      error: null,
    });
    supabase.client.from
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(insertChain);

    return request(app.getHttpServer())
      .post('/lists/l1/items')
      .set(auth)
      .send(validItem)
      .expect(201)
      .expect((res) => {
        expect(res.body.itemName).toBe('Milk');
      });
  });

  it('POST /lists/:listId/items → 201 with updated quantity when duplicate name exists', async () => {
    const listChain = mockChain({ data: { listId: 'l1' }, error: null });
    const lookupChain = mockChain({
      data: { itemId: 'i1', quantity: 3, unit: 'L' },
      error: null,
    });
    const updateChain = mockChain({
      data: { itemId: 'i1', itemName: 'Milk', quantity: 5, unit: 'L' },
      error: null,
    });
    supabase.client.from
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(lookupChain)
      .mockReturnValueOnce(updateChain);

    return request(app.getHttpServer())
      .post('/lists/l1/items')
      .set(auth)
      .send({ itemName: 'milk', quantity: 2, unit: 'L' })
      .expect(201)
      .expect((res) => {
        expect(res.body.quantity).toBe(5);
      });
  });

  it('POST /lists/:listId/items → 400 with invalid unit', () => {
    return request(app.getHttpServer())
      .post('/lists/l1/items')
      .set(auth)
      .send({ itemName: 'Milk', quantity: 1, unit: 'gallons' })
      .expect(400);
  });

  it('POST /lists/:listId/items → 400 with missing quantity', () => {
    return request(app.getHttpServer())
      .post('/lists/l1/items')
      .set(auth)
      .send({ itemName: 'Milk', unit: 'L' })
      .expect(400);
  });

  it('POST /lists/:listId/items → 404 when list not found', async () => {
    supabase.client.from.mockReturnValue(
      mockChain({ data: null, error: null }),
    );

    return request(app.getHttpServer())
      .post('/lists/missing/items')
      .set(auth)
      .send(validItem)
      .expect(404);
  });

  it('PUT /lists/:listId/items/:itemId → 200 with partial update', async () => {
    const listChain = mockChain({ data: { listId: 'l1' }, error: null });
    const updateChain = mockChain({
      data: { itemId: 'i1', quantity: 3 },
      error: null,
    });
    supabase.client.from
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(updateChain);

    return request(app.getHttpServer())
      .put('/lists/l1/items/i1')
      .set(auth)
      .send({ quantity: 3 })
      .expect(200);
  });

  it('PUT /lists/:listId/items/:itemId → 400 with invalid unit', () => {
    return request(app.getHttpServer())
      .put('/lists/l1/items/i1')
      .set(auth)
      .send({ unit: 'gallons' })
      .expect(400);
  });

  it('POST /lists/:listId/items/reset-completed → 200', async () => {
    supabase.client.from
      .mockReturnValueOnce(mockChain({ data: { listId: 'l1' }, error: null }))
      .mockReturnValueOnce(mockChain({ data: {}, error: null }));

    return request(app.getHttpServer())
      .post('/lists/l1/items/reset-completed')
      .set(auth)
      .expect(201); // NestJS @Post defaults to 201
  });

  it('DELETE /lists/:listId/items/:itemId → 204', async () => {
    supabase.client.from
      .mockReturnValueOnce(mockChain({ data: { listId: 'l1' }, error: null }))
      .mockReturnValueOnce(mockChain({ data: {}, error: null }));

    return request(app.getHttpServer())
      .delete('/lists/l1/items/i1')
      .set(auth)
      .expect(204);
  });

  it('DELETE /lists/:listId/items/:itemId → 404 when list not found', async () => {
    supabase.client.from.mockReturnValue(
      mockChain({ data: null, error: null }),
    );

    return request(app.getHttpServer())
      .delete('/lists/missing/items/i1')
      .set(auth)
      .expect(404);
  });
});
