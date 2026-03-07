export const TEST_USER = { id: 'user-test-id', email: 'test@example.com' };
export const TEST_TOKEN = 'test-token';

/** Creates a fresh mock chain that resolves to `result`. */
export function mockChain(result: { data: unknown; error: unknown }) {
  const c: Record<string, jest.Mock> = {};
  for (const m of [
    'select',
    'insert',
    'update',
    'upsert',
    'eq',
    'neq',
    'gt',
    'order',
    'range',
    'ilike',
  ]) {
    c[m] = jest.fn().mockReturnThis();
  }
  c['single'] = jest.fn().mockResolvedValue(result);
  c['maybeSingle'] = jest.fn().mockResolvedValue(result);
  (
    c as unknown as { then: (r: (v: unknown) => unknown) => Promise<unknown> }
  ).then = (resolve) => Promise.resolve(result).then(resolve);
  return c;
}

/** Builds a mock SupabaseService where the auth guard passes for TEST_TOKEN. */
export function createMockSupabaseService() {
  const mockGetUser = jest.fn().mockImplementation((token: string) => {
    if (token === TEST_TOKEN) {
      return Promise.resolve({ data: { user: TEST_USER }, error: null });
    }
    return Promise.resolve({
      data: { user: null },
      error: { message: 'Invalid token' },
    });
  });

  // by default every from() returns a no-op chain
  const mockFrom = jest
    .fn()
    .mockImplementation(() => mockChain({ data: null, error: null }));

  return {
    client: {
      auth: { getUser: mockGetUser },
      from: mockFrom,
    },
    adminClient: {
      auth: {
        admin: {
          deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
        },
      },
    },
  };
}
