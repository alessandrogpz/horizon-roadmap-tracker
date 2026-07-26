// Workspace schema migrations.
//
// Data reaches the app from two directions — the local Dexie record and a
// Google Drive backup written by some other device, possibly running an
// older version. Both go through `migrateWorkspace` before anything else
// touches them, so the rest of the app only ever sees the current shape.
//
// To add a migration: write a pure `Workspace -> Workspace` step in
// ./steps.ts and append it to MIGRATIONS. Appending is what advances
// CURRENT_SCHEMA_VERSION, so nothing else needs updating — and because
// `schemaVersion` is stamped on the record, each step runs once per device
// rather than on every single load.

import type { Workspace } from "../types";
import { migrateLegacyRotation, migrateLocalPaths, migratePerTrackLayout } from "./steps";

export { wrapLegacyAppState } from "./legacyAppState";

export interface WorkspaceMigration {
  /** Stable identifier — the list position is the schema version it produces. */
  id: string;
  /** Pure rewrite. Must be idempotent: pre-schemaVersion data replays all of them. */
  migrate: (workspace: Workspace) => Workspace;
}

/** Ordered, append-only. Never reorder or remove an entry — a device's stored
 *  `schemaVersion` is an index into this list. */
export const MIGRATIONS: WorkspaceMigration[] = [
  { id: "legacy-local-paths", migrate: migrateLocalPaths },
  { id: "legacy-rotation-config", migrate: migrateLegacyRotation },
  { id: "per-track-panel-layout", migrate: migratePerTrackLayout },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length;

export interface MigrationOutcome {
  workspace: Workspace;
  /** True when at least one step ran, i.e. the caller should persist the result. */
  changed: boolean;
}

/**
 * Brings a workspace up to the current schema. Data written before
 * `schemaVersion` existed reports version 0 and replays every step, which is
 * exactly what the app did unconditionally on each load before this pipeline.
 * Data from a *newer* app version (higher stamp than we know about) is passed
 * through untouched rather than mangled.
 */
export function migrateWorkspace(workspace: Workspace): MigrationOutcome {
  const from = workspace.schemaVersion ?? 0;
  if (from >= CURRENT_SCHEMA_VERSION) return { workspace, changed: false };

  let migrated = workspace;
  for (let i = from; i < MIGRATIONS.length; i += 1) {
    migrated = MIGRATIONS[i].migrate(migrated);
  }
  return { workspace: { ...migrated, schemaVersion: CURRENT_SCHEMA_VERSION }, changed: true };
}
