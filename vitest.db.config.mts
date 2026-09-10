import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Next resolves "@/..." to the repo root (tsconfig paths); tests need the same.
const root = path.dirname(fileURLToPath(import.meta.url));

// `npm run test:db`: tests against the local replica set (`npm run db:up`),
// as the horizon_test user on its own database.
export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    include: ["**/*.db.test.ts"],
    exclude: configDefaults.exclude,
    setupFiles: ["lib/__tests__/dbTestSetup.ts"],
    // One shared test database, so test files take turns.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
