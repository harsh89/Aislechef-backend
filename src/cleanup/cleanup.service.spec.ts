import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from './cleanup.service';
import { SupabaseService } from '../supabase/supabase.service';
import { createMockSupabaseService, mockChain } from '../../test/helpers/mock-supabase.factory';

describe('CleanupService', () => {
  let service: CleanupService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(async () => {
    supabase = createMockSupabaseService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  });

  it('does nothing when no expired users', async () => {
    supabase.client.from.mockReturnValue(mockChain({ data: [], error: null }));
    await expect(service.purgeExpiredAccounts()).resolves.not.toThrow();
  });

  it('purges expired accounts and their data', async () => {
    const expiredUsersChain = mockChain({ data: [{ userId: 'u1' }], error: null });
    const listsChain = mockChain({ data: [{ listId: 'l1' }], error: null });
    const deleteItemsChain = mockChain({ data: {}, error: null });
    const deleteListsChain = mockChain({ data: {}, error: null });
    const deleteUserChain = mockChain({ data: {}, error: null });

    supabase.client.from
      .mockReturnValueOnce(expiredUsersChain)  // SELECT expired users
      .mockReturnValueOnce(listsChain)          // SELECT lists
      .mockReturnValueOnce(deleteItemsChain)    // DELETE items
      .mockReturnValueOnce(deleteListsChain)    // DELETE lists
      .mockReturnValueOnce(deleteUserChain);    // DELETE user row

    supabase.adminClient.auth.admin.deleteUser = jest.fn().mockResolvedValue({});

    await service.purgeExpiredAccounts();

    expect(supabase.adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('u1');
  });
});
