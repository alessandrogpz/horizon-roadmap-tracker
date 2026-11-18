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
    // The Expo app is a separate package with its own toolchain (docs/MOBILE.md).
    "mobile/**",
    // Dot-directories hold local tool configuration and vendored third-party
    // sources, not this app's code. Linting them says nothing about the app and
    // breaks `npm run lint` — a CI step — whenever one appears in a checkout.
    "**/.*/**",
  ]),
]);

export default eslintConfig;
