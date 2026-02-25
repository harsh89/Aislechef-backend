import { HttpException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';

const mockGetUserById = jest.fn();
const mockUpdateUserById = jest.fn();
const mockDeleteUser = jest.fn();

function makeChain(result = { data: {}, error: null }) {
  const c: Record<string, jest.Mock> = {};
  for (const m of ['update', 'upsert', 'select', 'eq']) {
    c[m] = jest.fn().mockReturnThis();
  }
  c['single'] = jest.fn().mockResolvedValue(result);
  (c as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }).then =
    (resolve) => Promise.resolve(result).then(resolve);
  return c;
}

const mockFrom = jest.fn();

const mockSupabaseService = {
  client: { from: mockFrom },
  adminClient: {
    auth: {
      admin: {
        getUserById: mockGetUserById,
        updateUserById: mockUpdateUserById,
        deleteUser: mockDeleteUser,
      },
    },
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockFrom.mockReturnValue(makeChain());
    mockGetUserById.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
    });
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
  });

  describe('deleteAccount', () => {
    it('fetches email, upserts users row, and bans the user', async () => {
      await service.deleteAccount('user-123');

      expect(mockGetUserById).toHaveBeenCalledWith('user-123');
      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpdateUserById).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ ban_duration: '720h' }),
      );
    });

    it('upserts with isDeleted=true and a deletedAt timestamp', async () => {
      const chain = makeChain();
      mockFrom.mockReturnValue(chain);

      await service.deleteAccount('user-123');

      expect(chain['upsert']).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true, email: 'test@example.com' }),
        expect.anything(),
      );
    });
  });

  describe('restoreAccount', () => {
    const RECENT_DELETION = new Date(
      Date.now() - 5 * 24 * 60 * 60 * 1000,
    ).toISOString(); // 5 days ago

    const EXPIRED_DELETION = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString(); // 31 days ago

    it('unbans the user and clears soft-delete within grace period', async () => {
      const selectChain = makeChain({
        data: { userId: 'user-123', deletedAt: RECENT_DELETION },
        error: null,
      });
      const updateChain = makeChain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      await service.restoreAccount('test@example.com');

      expect(mockUpdateUserById).toHaveBeenCalledWith('user-123', {
        ban_duration: 'none',
      });
      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: false, deletedAt: null }),
      );
    });

    it('throws NotFoundException when no deleted account exists for the email', async () => {
      const selectChain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(selectChain);

      await expect(service.restoreAccount('ghost@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws HttpException (410) when grace period has expired', async () => {
      const selectChain = makeChain({
        data: { userId: 'user-123', deletedAt: EXPIRED_DELETION },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain);

      await expect(
        service.restoreAccount('test@example.com'),
      ).rejects.toThrow(HttpException);
    });
  });
});
