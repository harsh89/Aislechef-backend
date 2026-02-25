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

describe('Sync (e2e)', () => {
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

  const validPayload = {
    lists: [
      {
        listId: 'l1',
        name: 'Groceries',
        lastUpdated: '2024-01-01T12:00:00.000Z',
        isDeleted: false,
      },
    ],
    items: [
      {
        itemId: 'i1',
        listId: 'l1',
        itemName: 'Milk',
        quantity: 1,
        unit: 'L',
        lastUpdated: '2024-01-01T12:00:00.000Z',
        isDeleted: false,
      },
    ],
  };

  it('POST /sync → 201 with conflicts array', async () => {
    // list: new (not on server)
    const listSelectChain = mockChain({ data: null, error: null });
    const listInsertChain = mockChain({ data: {}, error: null });
    // item: new (not on server)
    const itemSelectChain = mockChain({ data: null, error: null });
    const itemInsertChain = mockChain({ data: {}, error: null });

    supabase.client.from
      .mockReturnValueOnce(listSelectChain)
      .mockReturnValueOnce(listInsertChain)
      .mockReturnValueOnce(itemSelectChain)
      .mockReturnValueOnce(itemInsertChain);

    return request(app.getHttpServer())
      .post('/sync')
      .set(auth)
      .send(validPayload)
      .expect(201)
      .expect((res) => {
        expect(Array.isArray(res.body.conflicts)).toBe(true);
        expect(res.body.conflicts).toHaveLength(0);
      });
  });

  it('POST /sync → 201 with conflicts when server has newer timestamps', async () => {
    const serverTs = '2024-01-02T00:00:00.000Z'; // newer than client
    const listSelectChain = mockChain({
      data: { listId: 'l1', lastUpdated: serverTs },
      error: null,
    });
    const itemSelectChain = mockChain({
      data: { itemId: 'i1', lastUpdated: serverTs },
      error: null,
    });
    supabase.client.from
      .mockReturnValueOnce(listSelectChain)
      .mockReturnValueOnce(itemSelectChain);

    return request(app.getHttpServer())
      .post('/sync')
      .set(auth)
      .send(validPayload)
      .expect(201)
      .expect((res) => {
        expect(res.body.conflicts).toHaveLength(2);
      });
  });

  it('POST /sync → 400 with invalid unit in items', () => {
    const badPayload = {
      lists: [],
      items: [
        {
          itemId: 'i1',
          listId: 'l1',
          itemName: 'Milk',
          quantity: 1,
          unit: 'gallons',
          lastUpdated: '2024-01-01T12:00:00.000Z',
          isDeleted: false,
        },
      ],
    };

    return request(app.getHttpServer())
      .post('/sync')
      .set(auth)
      .send(badPayload)
      .expect(400);
  });

  it('POST /sync → 401 without auth token', () => {
    return request(app.getHttpServer())
      .post('/sync')
      .send(validPayload)
      .expect(401);
  });
});
