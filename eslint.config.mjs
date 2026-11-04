import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Expo app is a separate package with its own toolchain (MOBILE_PLAN.md).
    "mobile/**",
    // Agent skills vendored into the repo: somebody else's source, shipped with
    // its own bundled assets. Linting it says nothing about this app, and it
    // fails `npm run lint` — a CI step — the moment the folder is committed.
    ".claude/**",
  ]),
]);

export default eslintConfig;
