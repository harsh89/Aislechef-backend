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

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let supabase: ReturnType<typeof createMockSupabaseService>;

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

  describe('DELETE /auth/account', () => {
    it('204 with valid token', async () => {
      supabase.adminClient.auth.admin.getUserById = jest
        .fn()
        .mockResolvedValue({ data: { user: { email: 'test@example.com' } } });
      supabase.adminClient.auth.admin.updateUserById = jest
        .fn()
        .mockResolvedValue({ data: {}, error: null });
      supabase.client.from.mockReturnValue(mockChain({ data: {}, error: null }));

      return request(app.getHttpServer())
        .delete('/auth/account')
        .set('Authorization', `Bearer ${TEST_TOKEN}`)
        .expect(204);
    });

    it('401 without Authorization header', () => {
      return request(app.getHttpServer()).delete('/auth/account').expect(401);
    });

    it('401 with invalid token', () => {
      return request(app.getHttpServer())
        .delete('/auth/account')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);
    });
  });

  describe('POST /auth/restore', () => {
    const RECENT_DELETION = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString();

    it('204 with valid email of a recently deleted account', async () => {
      supabase.client.from
        .mockReturnValueOnce(
          mockChain({
            data: { userId: 'user-123', deletedAt: RECENT_DELETION },
            error: null,
          }),
        )
        .mockReturnValueOnce(mockChain({ data: {}, error: null }));

      supabase.adminClient.auth.admin.updateUserById = jest
        .fn()
        .mockResolvedValue({ data: {}, error: null });

      return request(app.getHttpServer())
        .post('/auth/restore')
        .send({ email: 'test@example.com' })
        .expect(204);
    });

    it('204 without an Authorization header (public endpoint)', () => {
      supabase.client.from
        .mockReturnValueOnce(
          mockChain({
            data: { userId: 'user-123', deletedAt: RECENT_DELETION },
            error: null,
          }),
        )
        .mockReturnValueOnce(mockChain({ data: {}, error: null }));

      supabase.adminClient.auth.admin.updateUserById = jest
        .fn()
        .mockResolvedValue({ data: {}, error: null });

      return request(app.getHttpServer())
        .post('/auth/restore')
        .send({ email: 'test@example.com' })
        .expect(204);
    });

    it('404 when no deleted account exists for the email', async () => {
      supabase.client.from.mockReturnValue(
        mockChain({ data: null, error: null }),
      );

      return request(app.getHttpServer())
        .post('/auth/restore')
        .send({ email: 'ghost@example.com' })
        .expect(404);
    });

    it('410 when grace period has expired', async () => {
      const expiredDeletion = new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString();

      supabase.client.from.mockReturnValue(
        mockChain({
          data: { userId: 'user-123', deletedAt: expiredDeletion },
          error: null,
        }),
      );

      return request(app.getHttpServer())
        .post('/auth/restore')
        .send({ email: 'test@example.com' })
        .expect(410);
    });

    it('400 when email is missing', () => {
      return request(app.getHttpServer())
        .post('/auth/restore')
        .send({})
        .expect(400);
    });

    it('400 when email is invalid', () => {
      return request(app.getHttpServer())
        .post('/auth/restore')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});
