import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { ListsService } from './lists.service';

/** Build a chainable Supabase query-builder mock that resolves to `result`. */
function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, jest.Mock> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'eq',
    'order',
    'range',
    'ilike',
  ] as const;
  for (const m of methods) c[m] = jest.fn().mockReturnThis();
  c['single'] = jest.fn().mockResolvedValue(result);
  // make the builder itself awaitable
  (
    c as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }
  ).then = (resolve) => Promise.resolve(result).then(resolve);
  return c;
}

const mockFrom = jest.fn();
const mockSupabaseService = { client: { from: mockFrom } };

describe('ListsService', () => {
  let service: ListsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();
    service = module.get<ListsService>(ListsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('inserts a new list and returns it', async () => {
      const newList = { listId: 'l1', name: 'Groceries', userId: 'u1' };
      const b = chain({ data: newList, error: null });
      mockFrom.mockReturnValue(b);

      const result = await service.create('u1', { name: 'Groceries' });

      expect(mockFrom).toHaveBeenCalledWith('lists');
      expect(b['insert']).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          name: 'Groceries',
          isDeleted: false,
        }),
      );
      expect(result).toEqual(newList);
    });

    it('throws when Supabase returns an error', async () => {
      const b = chain({ data: null, error: { message: 'DB error' } });
      mockFrom.mockReturnValue(b);
      await expect(service.create('u1', { name: 'X' })).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('findAll', () => {
    it('returns all non-deleted lists for the user', async () => {
      const lists = [{ listId: 'l1' }, { listId: 'l2' }];
      const b = chain({ data: lists, error: null });
      mockFrom.mockReturnValue(b);

      const result = await service.findAll('u1');

      expect(b['eq']).toHaveBeenCalledWith('userId', 'u1');
      expect(b['eq']).toHaveBeenCalledWith('isDeleted', false);
      expect(result).toEqual(lists);
    });
  });

  describe('findOne', () => {
    it('returns the list with paginated items', async () => {
      const listData = { listId: 'l1', name: 'Groceries' };
      const itemsData = [{ itemId: 'i1' }];
      const listChain = chain({ data: listData, error: null });
      const itemsChain = chain({ data: itemsData, error: null });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(itemsChain);

      const result = await service.findOne('u1', 'l1', 1, 20);

      expect(result).toMatchObject({ ...listData, items: itemsData });
      expect(result).toHaveProperty('pagination');
      expect(itemsChain['range']).toHaveBeenCalledWith(0, 19);
    });

    it('throws NotFoundException when list does not exist', async () => {
      const b = chain({ data: null, error: { message: 'PGRST116' } });
      mockFrom.mockReturnValue(b);
      await expect(service.findOne('u1', 'missing', 1, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('uses correct range for page 2, limit 10', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const itemsChain = chain({ data: [], error: null });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(itemsChain);

      await service.findOne('u1', 'l1', 2, 10);
      expect(itemsChain['range']).toHaveBeenCalledWith(10, 19);
    });
  });

  describe('update', () => {
    it('updates the list name and returns updated list', async () => {
      const updated = { listId: 'l1', name: 'Updated' };
      const b = chain({ data: updated, error: null });
      mockFrom.mockReturnValue(b);

      const result = await service.update('u1', 'l1', { name: 'Updated' });

      expect(b['update']).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated' }),
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when list not found', async () => {
      const b = chain({ data: null, error: null });
      mockFrom.mockReturnValue(b);
      await expect(
        service.update('u1', 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('soft-deletes the list and all its items', async () => {
      const listChain = chain({ data: {}, error: null });
      const itemsChain = chain({ data: {}, error: null });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(itemsChain);

      await service.softDelete('u1', 'l1');

      expect(listChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
      expect(itemsChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });
  });

  describe('searchItems', () => {
    it('returns items matching the query', async () => {
      const ownerChain = chain({ data: { listId: 'l1' }, error: null });
      const searchChain = chain({
        data: [{ itemId: 'i1', itemName: 'Apple' }],
        error: null,
      });
      mockFrom.mockReturnValueOnce(ownerChain).mockReturnValueOnce(searchChain);

      const result = await service.searchItems('u1', 'l1', 'apple');

      expect(searchChain['ilike']).toHaveBeenCalledWith('itemName', '%apple%');
      expect(result).toEqual([{ itemId: 'i1', itemName: 'Apple' }]);
    });

    it('throws NotFoundException when list not found', async () => {
      const ownerChain = chain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(ownerChain);
      await expect(service.searchItems('u1', 'missing', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns all items when query is empty string', async () => {
      const ownerChain = chain({ data: { listId: 'l1' }, error: null });
      const searchChain = chain({ data: [{ itemId: 'i1' }], error: null });
      mockFrom.mockReturnValueOnce(ownerChain).mockReturnValueOnce(searchChain);

      await service.searchItems('u1', 'l1', '');
      expect(searchChain['ilike']).toHaveBeenCalledWith('itemName', '%%');
    });
  });
});
