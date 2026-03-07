# Backend — Development Workflow

For every feature, follow this loop until complete:
1. Implement the service + controller
2. Run: `npm run lint`
3. Fix any lint errors. Repeat until clean.
4. Write unit tests (`*.spec.ts` co-located with source)
5. Run: `npm run lint` on test files. Fix until clean.
6. Run: `npm run test -- --testPathPattern=<module>`
7. Fix any failures. Repeat until green.
8. Write e2e tests (`test/*.e2e-spec.ts`)
9. Run: `npm run lint` on e2e test files. Fix until clean.
10. Run: `npm run test:e2e -- --testPathPattern=<module>`
11. Fix any failures. Repeat until green.
12. Only then move to the next feature.

## Commands

- All unit tests:       `npm run test`
- Single unit test:     `npm run test -- --testPathPattern=lists`
- All e2e tests:        `npm run test:e2e`
- Single e2e test:      `npm run test:e2e -- --testPathPattern=lists`
- Watch mode:           `npm run test:watch`
- Lint (auto-fix):      `npm run lint`
- Format:               `npm run format`
