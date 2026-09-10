// Runs before every database test file: points the app's connection at the
// test database, which only the horizon_test user can reach.

import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}

if (!process.env.MONGODB_TEST_URI) {
  throw new Error("MONGODB_TEST_URI isn't set. Run `npm run db:up` first; it starts the database and writes it.");
}
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI;
