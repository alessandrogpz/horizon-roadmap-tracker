import { configDefaults, defineConfig } from "vitest/config";

// `npm run test:db`: tests against the local replica set (`npm run db:up`),
// as the horizon_test user on its own database.
export default defineConfig({
  test: {
    include: ["**/*.db.test.ts"],
    exclude: configDefaults.exclude,
    setupFiles: ["lib/__tests__/dbTestSetup.ts"],
    // One shared test database, so test files take turns.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
