// Loads .env.local into process.env for the TypeScript scripts (Next.js does
// this for the app itself). Values already set in the environment win.

import { existsSync, readFileSync } from "node:fs";

export function loadEnvLocal(): void {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

/** The generated dataset's database, as its own least-privilege user. */
export function perfUri(): string {
  loadEnvLocal();
  const uri = process.env.MONGODB_PERF_URI;
  if (!uri) throw new Error("MONGODB_PERF_URI isn't set. Run `npm run db:up` first; it writes it.");
  return uri;
}

/** `--name value` pairs from the command line. */
export function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}
