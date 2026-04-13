import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase/supabase.service';
import { UnitEnum } from './dto/create-item.dto';
import { ItemsService } from './items.service';

function chain(result: { data: unknown; error: unknown }) {
  const c: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'ilike']) {
    c[m] = jest.fn().mockReturnThis();
  }
  c['single'] = jest.fn().mockResolvedValue(result);
  c['maybeSingle'] = jest.fn().mockResolvedValue(result);
  (
    c as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }
  ).then = (resolve) => Promise.resolve(result).then(resolve);
  return c;
}

const mockFrom = jest.fn();
const mockSupabaseService = { client: { from: mockFrom } };

describe('ItemsService', () => {
  let service: ItemsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();
    service = module.get<ItemsService>(ItemsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates an item when no duplicate name exists', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const lookupChain = chain({ data: null, error: null });
      const insertChain = chain({ data: { itemId: 'i1' }, error: null });
      mockFrom
        .mockReturnValueOnce(listChain)
        .mockReturnValueOnce(lookupChain)
        .mockReturnValueOnce(insertChain);

      const dto = { itemName: 'Milk', quantity: 2, unit: UnitEnum.L };
      const result = await service.create('u1', 'l1', dto);

      expect(insertChain['insert']).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'l1',
          itemName: 'Milk',
          quantity: 2,
          unit: 'L',
        }),
      );
      expect(result).toEqual({ itemId: 'i1' });
    });

    it('updates quantity when item with same name already exists', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const lookupChain = chain({
        data: { itemId: 'i1', quantity: 3, unit: UnitEnum.L },
        error: null,
      });
      const updateChain = chain({
        data: { itemId: 'i1', itemName: 'Milk', quantity: 5, unit: 'L' },
        error: null,
      });
      mockFrom
        .mockReturnValueOnce(listChain)
        .mockReturnValueOnce(lookupChain)
        .mockReturnValueOnce(updateChain);

      const dto = { itemName: 'Milk', quantity: 2, unit: UnitEnum.L };
      const result = await service.create('u1', 'l1', dto);

      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 5 }),
      );
      expect(result).toEqual({ itemId: 'i1', itemName: 'Milk', quantity: 5, unit: 'L' });
    });

    it('matches duplicate name case-insensitively', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const lookupChain = chain({
        data: { itemId: 'i1', quantity: 1, unit: UnitEnum.PCS },
        error: null,
      });
      const updateChain = chain({
        data: { itemId: 'i1', quantity: 3, unit: 'pcs' },
        error: null,
      });
      mockFrom
        .mockReturnValueOnce(listChain)
        .mockReturnValueOnce(lookupChain)
        .mockReturnValueOnce(updateChain);

      // 'milk' should match existing 'Milk' via ilike
      const dto = { itemName: 'milk', quantity: 2, unit: UnitEnum.PCS };
      await service.create('u1', 'l1', dto);

      expect(lookupChain['ilike']).toHaveBeenCalledWith('itemName', 'milk');
      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 3 }),
      );
    });

    it('throws NotFoundException when list does not exist', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      await expect(
        service.create('u1', 'missing', {
          itemName: 'X',
          quantity: 1,
          unit: UnitEnum.PCS,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException on DB error during upsert update', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const lookupChain = chain({ data: { itemId: 'i1', quantity: 1, unit: UnitEnum.L }, error: null });
      const updateChain = chain({ data: null, error: { message: 'column does not exist' } });
      mockFrom
        .mockReturnValueOnce(listChain)
        .mockReturnValueOnce(lookupChain)
        .mockReturnValueOnce(updateChain);

      await expect(
        service.create('u1', 'l1', { itemName: 'Milk', quantity: 2, unit: UnitEnum.L }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('updates an item after verifying list ownership', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const updateChain = chain({
        data: { itemId: 'i1', itemName: 'Milk 2L' },
        error: null,
      });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(updateChain);

      const result = await service.update('u1', 'l1', 'i1', {
        itemName: 'Milk 2L',
      });
      expect(result).toEqual({ itemId: 'i1', itemName: 'Milk 2L' });
    });

    it('throws NotFoundException when item not found', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const updateChain = chain({ data: null, error: null });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(updateChain);

      await expect(service.update('u1', 'l1', 'missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws InternalServerErrorException on DB error', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const updateChain = chain({ data: null, error: { message: 'column does not exist' } });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(updateChain);

      await expect(service.update('u1', 'l1', 'i1', { isCompleted: true })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('resetCompleted', () => {
    it('resets isCompleted for all items in the list', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const updateChain = chain({ data: {}, error: null });
      mockFrom
        .mockReturnValueOnce(listChain)
        .mockReturnValueOnce(updateChain);

      await expect(service.resetCompleted('u1', 'l1')).resolves.not.toThrow();
      expect(updateChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ isCompleted: false }),
      );
    });

    it('throws NotFoundException when list not found', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      await expect(service.resetCompleted('u1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('soft-deletes an item after verifying list ownership', async () => {
      const listChain = chain({ data: { listId: 'l1' }, error: null });
      const deleteChain = chain({ data: {}, error: null });
      mockFrom.mockReturnValueOnce(listChain).mockReturnValueOnce(deleteChain);

      await expect(service.softDelete('u1', 'l1', 'i1')).resolves.not.toThrow();
      expect(deleteChain['update']).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });

    it('throws NotFoundException when list not found', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: null }));
      await expect(service.softDelete('u1', 'missing', 'i1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
