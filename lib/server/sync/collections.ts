// The sync collections, their indexes, and their $jsonSchema validators.
//
// The validators are a second layer behind the zod schemas (threat T1): even
// if a bug in the server let a malformed document through, MongoDB itself
// refuses to store it. They check the shape the server writes, not every
// business rule.
//
// Least privilege has a consequence here. The app's database user has
// readWrite, which can create a collection with its validator and create
// indexes, but not change a validator afterwards (that needs `collMod`, an
// admin privilege). So a changed validator is applied by an administrator,
// and the app only warns until then.

// The driver's types, via Mongoose, which pins the driver version.
import type { mongo } from "mongoose";

type Db = mongo.Db;
type Document = mongo.Document;
type IndexDescription = mongo.IndexDescription;

export const TRACKS = "tracks";
export const COMPLETIONS = "completions";
export const NOTES = "notes";
export const AUDIT_LOG = "auditLog";

const number = { bsonType: "number", minimum: 0 };
const string = (maxLength: number) => ({ bsonType: "string", maxLength });

const itemState = {
  bsonType: "object",
  required: ["id", "done", "updatedAt"],
  additionalProperties: false,
  properties: { id: string(200), done: { bsonType: "bool" }, updatedAt: number },
};

interface CollectionSpec {
  validator: Document;
  indexes: IndexDescription[];
}

export const SPECS: Record<string, CollectionSpec> = {
  [TRACKS]: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "trackId", "schemaVersion", "configVersion", "updatedAt", "meta"],
        properties: {
          userId: { bsonType: "objectId" },
          trackId: { bsonType: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
          schemaVersion: number,
          configVersion: number,
          updatedAt: { bsonType: "date" },
          meta: {
            bsonType: "object",
            required: ["id", "name"],
            properties: { id: string(200), name: string(500), archived: { bsonType: "bool" } },
          },
          phases: { bsonType: "array", maxItems: 500, items: { bsonType: "object", required: ["id", "title"] } },
          materials: {
            bsonType: "array",
            maxItems: 5000,
            items: {
              bsonType: "object",
              required: ["id", "title"],
              properties: { id: string(200), title: string(2000), updatedAt: number, archived: { bsonType: "bool" } },
            },
          },
          roadmapContent: string(500_000),
        },
      },
    },
    indexes: [{ key: { userId: 1, trackId: 1 }, name: "user_track", unique: true }],
  },

  [COMPLETIONS]: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "trackId", "date", "tasks", "revisions", "accomplishments", "updatedAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "objectId" },
          userId: { bsonType: "objectId" },
          trackId: { bsonType: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" },
          date: { bsonType: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
          tasks: { bsonType: "array", maxItems: 2000, items: itemState },
          revisions: { bsonType: "array", maxItems: 2000, items: itemState },
          accomplishments: {
            bsonType: "array",
            maxItems: 2000,
            items: {
              bsonType: "object",
              required: ["title", "done", "updatedAt"],
              additionalProperties: false,
              properties: {
                title: string(2000),
                description: string(10_000),
                plain: { bsonType: "bool" },
                done: { bsonType: "bool" },
                updatedAt: number,
              },
            },
          },
          updatedAt: { bsonType: "date" },
        },
      },
    },
    // Every read is "this user's track, by day", so this one index serves
    // them all, and makes (user, track, day) unique: one bucket per day.
    indexes: [{ key: { userId: 1, trackId: 1, date: 1 }, name: "user_track_date", unique: true }],
  },

  [NOTES]: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "noteId", "kind", "content", "updatedAt"],
        additionalProperties: false,
        properties: {
          _id: { bsonType: "objectId" },
          userId: { bsonType: "objectId" },
          noteId: { bsonType: "string", pattern: "^[A-Za-z0-9_-]{1,200}$" },
          kind: { enum: ["material", "notepad", "todo"] },
          trackId: { bsonType: "string" },
          content: string(500_000),
          updatedAt: number,
        },
      },
    },
    indexes: [{ key: { userId: 1, noteId: 1 }, name: "user_note", unique: true }],
  },

  // One entry per sync that changed something (threat R1): who, when, and how
  // many documents. Deleted after 90 days.
  [AUDIT_LOG]: {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["userId", "at", "action"],
        properties: { userId: { bsonType: "objectId" }, at: { bsonType: "date" }, action: string(50) },
      },
    },
    indexes: [{ key: { at: 1 }, name: "expire_after_90_days", expireAfterSeconds: 90 * 24 * 60 * 60 }],
  },
};

const ensured = new WeakMap<Db, Promise<void>>();

/** Creates any missing collection with its validator, and its indexes. Once
 *  per process per database; both operations are idempotent. */
export function ensureSyncCollections(db: Db): Promise<void> {
  let promise = ensured.get(db);
  if (!promise) {
    promise = createAll(db).catch((error) => {
      ensured.delete(db);
      throw error;
    });
    ensured.set(db, promise);
  }
  return promise;
}

async function createAll(db: Db): Promise<void> {
  const existing = new Map(
    (await db.listCollections({}, { nameOnly: false }).toArray()).map((c) => [c.name, c as Document])
  );

  for (const [name, spec] of Object.entries(SPECS)) {
    const current = existing.get(name);
    if (!current) {
      try {
        await db.createCollection(name, { validator: spec.validator, validationLevel: "strict", validationAction: "error" });
      } catch (error) {
        // Another instance created it a moment ago.
        if ((error as { codeName?: string }).codeName !== "NamespaceExists") throw error;
      }
    } else if (JSON.stringify(current.options?.validator) !== JSON.stringify(spec.validator)) {
      try {
        await db.command({ collMod: name, validator: spec.validator, validationLevel: "strict", validationAction: "error" });
      } catch (error) {
        if ((error as { codeName?: string }).codeName !== "Unauthorized") throw error;
        console.warn(`The ${name} validator is out of date; an administrator needs to apply it (collMod).`);
      }
    }
    await db.collection(name).createIndexes(spec.indexes);
  }
}
