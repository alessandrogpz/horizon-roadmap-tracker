import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Next resolves "@/..." to the repo root (tsconfig paths); tests need the same.
const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    // Tests that need the local MongoDB run separately: `npm run test:db`
    // (vitest.db.config.mts). `npm test` stays fast and needs nothing running.
    exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
  },
});
