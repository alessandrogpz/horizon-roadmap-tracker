// The server's one MongoDB connection, via Mongoose. Server-only: nothing in
// lib/server may be imported by browser code.
//
// Mongoose keeps a pool of connections and reuses it for every request, so the
// connect promise lives on globalThis. That survives Next's dev-mode module
// reloads, and on Vercel a warm function reuses it across invocations instead
// of opening a new pool each time.

import mongoose from "mongoose";

// Query filters are built from request data, so neutralise operator injection
// at the source: a value like {"$ne": null} arriving where a plain value was
// expected is wrapped in $eq and matched literally instead of as an operator.
// Operators the code means to use must be marked with mongoose.trusted().
mongoose.set("sanitizeFilter", true);
// Filtering on a field the schema doesn't define is a bug, not a query.
mongoose.set("strictQuery", "throw");

export class DbUnavailableError extends Error {
  name = "DbUnavailableError";
}

const cache = globalThis as typeof globalThis & { horizonDb?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return Promise.reject(new DbUnavailableError("MONGODB_URI is not set"));

  cache.horizonDb ??= mongoose
    .connect(uri, {
      // Fail a request within seconds when the database is unreachable,
      // rather than hanging until the platform's timeout.
      serverSelectionTimeoutMS: 5000,
      // Small, because every warm serverless instance keeps its own pool and
      // Atlas's free tier allows 500 connections in total.
      maxPoolSize: 5,
    })
    .catch((error) => {
      cache.horizonDb = undefined; // let the next request try again
      throw error;
    });
  return cache.horizonDb;
}

export { mongoose };
