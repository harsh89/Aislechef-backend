import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  deleteAccount: jest.fn(),
  restoreAccount: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('deleteAccount → calls authService.deleteAccount with the user id', async () => {
    mockAuthService.deleteAccount.mockResolvedValue(undefined);
    await controller.deleteAccount({ id: 'user-123' });
    expect(mockAuthService.deleteAccount).toHaveBeenCalledWith('user-123');
  });

  it('restoreAccount → calls authService.restoreAccount with the email', async () => {
    mockAuthService.restoreAccount.mockResolvedValue(undefined);
    await controller.restoreAccount({ email: 'test@example.com' });
    expect(mockAuthService.restoreAccount).toHaveBeenCalledWith('test@example.com');
  });
});
