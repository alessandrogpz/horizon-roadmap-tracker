import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests that need the local MongoDB run separately: `npm run test:db`
    // (vitest.db.config.ts). `npm test` stays fast and needs nothing running.
    exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
  },
});
