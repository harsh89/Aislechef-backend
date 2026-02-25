import { Test, TestingModule } from '@nestjs/testing';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';

const mockListsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  searchItems: jest.fn(),
};
const USER = { id: 'user-123' };

describe('ListsController', () => {
  let controller: ListsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListsController],
      providers: [{ provide: ListsService, useValue: mockListsService }],
    }).compile();

    controller = module.get<ListsController>(ListsController);
    jest.clearAllMocks();
  });

  it('create → calls service.create', async () => {
    mockListsService.create.mockResolvedValue({ listId: 'l1' });
    await controller.create(USER, { name: 'Groceries' });
    expect(mockListsService.create).toHaveBeenCalledWith('user-123', {
      name: 'Groceries',
    });
  });

  it('findAll → calls service.findAll', async () => {
    mockListsService.findAll.mockResolvedValue([]);
    await controller.findAll(USER);
    expect(mockListsService.findAll).toHaveBeenCalledWith('user-123');
  });

  it('findOne → passes page and limit as numbers', async () => {
    mockListsService.findOne.mockResolvedValue({});
    await controller.findOne(USER, 'l1', '2', '10');
    expect(mockListsService.findOne).toHaveBeenCalledWith(
      'user-123',
      'l1',
      2,
      10,
    );
  });

  it('update → calls service.update', async () => {
    mockListsService.update.mockResolvedValue({});
    await controller.update(USER, 'l1', { name: 'Updated' });
    expect(mockListsService.update).toHaveBeenCalledWith('user-123', 'l1', {
      name: 'Updated',
    });
  });

  it('softDelete → calls service.softDelete', async () => {
    mockListsService.softDelete.mockResolvedValue(undefined);
    await controller.softDelete(USER, 'l1');
    expect(mockListsService.softDelete).toHaveBeenCalledWith('user-123', 'l1');
  });

  it('search → calls service.searchItems with query', async () => {
    mockListsService.searchItems.mockResolvedValue([]);
    await controller.search(USER, 'l1', 'apple');
    expect(mockListsService.searchItems).toHaveBeenCalledWith(
      'user-123',
      'l1',
      'apple',
    );
  });
});
