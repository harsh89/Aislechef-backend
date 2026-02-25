// Stub environment variables so providers can initialise during e2e tests
// without requiring real credentials. SupabaseService and OpenAI are overridden
// with mocks in every test file, so these values are never actually used.
process.env['SUPABASE_URL'] = 'https://test.supabase.co';
process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key';
process.env['OPENAI_API_KEY'] = 'test-openai-key';
