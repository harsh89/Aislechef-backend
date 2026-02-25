import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { UnitEnum } from './dto/create-item.dto';

const mockItemsService = {
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};
const USER = { id: 'user-123' };

describe('ItemsController', () => {
  let controller: ItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [{ provide: ItemsService, useValue: mockItemsService }],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
    jest.clearAllMocks();
  });

  it('create → calls service.create', async () => {
    mockItemsService.create.mockResolvedValue({ itemId: 'i1' });
    const dto = { itemName: 'Milk', quantity: 1, unit: UnitEnum.L };
    await controller.create(USER, 'l1', dto);
    expect(mockItemsService.create).toHaveBeenCalledWith('user-123', 'l1', dto);
  });

  it('update → calls service.update', async () => {
    mockItemsService.update.mockResolvedValue({});
    await controller.update(USER, 'l1', 'i1', { quantity: 2 });
    expect(mockItemsService.update).toHaveBeenCalledWith(
      'user-123',
      'l1',
      'i1',
      { quantity: 2 },
    );
  });

  it('softDelete → calls service.softDelete', async () => {
    mockItemsService.softDelete.mockResolvedValue(undefined);
    await controller.softDelete(USER, 'l1', 'i1');
    expect(mockItemsService.softDelete).toHaveBeenCalledWith(
      'user-123',
      'l1',
      'i1',
    );
  });
});
