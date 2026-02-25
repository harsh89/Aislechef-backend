import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

const mockGetUser = jest.fn();
const mockSupabaseService = {
  client: { auth: { getUser: mockGetUser } },
};

const mockReflector = {
  getAllAndOverride: jest.fn().mockReturnValue(false),
};

function makeContext(authHeader?: string): ExecutionContext {
  const request = { headers: { authorization: authHeader } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;

  beforeEach(() => {
    guard = new SupabaseAuthGuard(
      mockSupabaseService as never,
      mockReflector as never,
    );
    jest.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(false);
  });

  it('allows access to @Public() routes without a token', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const ctx = makeContext(undefined);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('attaches user and returns true for a valid token', async () => {
    const user = { id: 'user-123', email: 'test@example.com' };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });

    const ctx = makeContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockGetUser).toHaveBeenCalledWith('valid-token');
    const req = ctx.switchToHttp().getRequest<{ user: unknown }>();
    expect(req.user).toEqual(user);
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when header does not start with Bearer', async () => {
    const ctx = makeContext('Basic some-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when getUser returns an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    const ctx = makeContext('Bearer expired-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when getUser returns null user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const ctx = makeContext('Bearer unknown-token');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
