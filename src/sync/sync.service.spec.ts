import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { UnitEnum } from '../items/dto/create-item.dto';
import { SyncService } from './sync.service';
import { SyncDto } from './dto/sync.dto';

const SERVER_TS = '2024-01-01T10:00:00.000Z';
const CLIENT_NEWER = '2024-01-01T11:00:00.000Z'; // newer than server
const CLIENT_OLDER = '2024-01-01T09:00:00.000Z'; // older than server

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'upsert', 'eq']) {
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

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();
    service = module.get<SyncService>(SyncService);
    jest.clearAllMocks();
  });

  const baseList = {
    listId: 'l1',
    name: 'Groceries',
    isDeleted: false,
  };

  const baseItem = {
    itemId: 'i1',
    listId: 'l1',
    itemName: 'Milk',
    quantity: 1,
    unit: UnitEnum.L,
    isDeleted: false,
  };

  describe('list sync', () => {
    it('updates list when client timestamp is newer', async () => {
      const selectChain = chain({
        data: { listId: 'l1', lastUpdated: SERVER_TS },
        error: null,
      });
      const updateChain = chain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      const dto: SyncDto = {
        lists: [{ ...baseList, lastUpdated: CLIENT_NEWER }],
        items: [],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(0);
      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Groceries' }),
      );
    });

    it('returns conflict when server timestamp is newer', async () => {
      const selectChain = chain({
        data: { listId: 'l1', lastUpdated: SERVER_TS },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain);

      const dto: SyncDto = {
        lists: [{ ...baseList, lastUpdated: CLIENT_OLDER }],
        items: [],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({ type: 'list', id: 'l1' });
    });

    it('inserts list when it does not exist on server', async () => {
      const selectChain = chain({ data: null, error: null });
      const insertChain = chain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(insertChain);

      const dto: SyncDto = {
        lists: [{ ...baseList, lastUpdated: CLIENT_NEWER }],
        items: [],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(0);
      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'l1', userId: 'u1' }),
      );
    });

    it('propagates soft-delete when client marks list as deleted', async () => {
      const selectChain = chain({
        data: { listId: 'l1', lastUpdated: SERVER_TS },
        error: null,
      });
      const updateChain = chain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      const dto: SyncDto = {
        lists: [{ ...baseList, isDeleted: true, lastUpdated: CLIENT_NEWER }],
        items: [],
      };
      await service.sync('u1', dto);

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });
  });

  describe('item sync', () => {
    it('updates item when client timestamp is newer', async () => {
      const selectChain = chain({
        data: { itemId: 'i1', lastUpdated: SERVER_TS },
        error: null,
      });
      const updateChain = chain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      const dto: SyncDto = {
        lists: [],
        items: [{ ...baseItem, lastUpdated: CLIENT_NEWER }],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(0);
      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ itemName: 'Milk' }),
      );
    });

    it('returns conflict when server timestamp is newer', async () => {
      const selectChain = chain({
        data: { itemId: 'i1', lastUpdated: SERVER_TS },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain);

      const dto: SyncDto = {
        lists: [],
        items: [{ ...baseItem, lastUpdated: CLIENT_OLDER }],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({ type: 'item', id: 'i1' });
    });

    it('inserts item when it does not exist on server', async () => {
      const selectChain = chain({ data: null, error: null });
      const insertChain = chain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(insertChain);

      const dto: SyncDto = {
        lists: [],
        items: [{ ...baseItem, lastUpdated: CLIENT_NEWER }],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(0);
      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 'i1', listId: 'l1' }),
      );
    });
  });

  describe('mixed batch', () => {
    it('handles multiple lists and items, returning all conflicts', async () => {
      // list l1: client older → conflict
      const l1Select = chain({
        data: { listId: 'l1', lastUpdated: SERVER_TS },
        error: null,
      });
      // item i1: client newer → update
      const i1Select = chain({
        data: { itemId: 'i1', lastUpdated: SERVER_TS },
        error: null,
      });
      const i1Update = chain({ data: {}, error: null });

      mockFrom
        .mockReturnValueOnce(l1Select) // list select
        .mockReturnValueOnce(i1Select) // item select
        .mockReturnValueOnce(i1Update); // item update

      const dto: SyncDto = {
        lists: [{ ...baseList, lastUpdated: CLIENT_OLDER }],
        items: [{ ...baseItem, lastUpdated: CLIENT_NEWER }],
      };
      const result = await service.sync('u1', dto);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('list');
    });
  });
});
