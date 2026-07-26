// The IndexedDB schema, and nothing else. Reads and writes go through
// lib/workspaceRepo.ts (workspace) and lib/notes.ts (notes) so those modules
// stay the only places that know how a record is shaped.

import Dexie, { type Table } from "dexie";
import type { AppState, Workspace } from "./types";
import { wrapLegacyAppState } from "./migrations/legacyAppState";

export interface AppStateRecord {
  id: string;
  data: AppState;
}

export interface NoteRecord {
  id: string; // materialId
  content: string;
  updatedAt: number;
}

export interface WorkspaceRecord {
  id: string;
  data: Workspace;
}

export class ProductivityDb extends Dexie {
  /** Legacy v1 table — kept declared (never dropped) so the row that lived
   *  here before the multi-track upgrade survives untouched as an automatic
   *  rollback snapshot. Nothing writes to it after v2. */
  appState!: Table<AppStateRecord>;
  notes!: Table<NoteRecord>;
  workspace!: Table<WorkspaceRecord>;

  /** dbName is overridable so tests can exercise the real migration logic
   *  against an isolated, uniquely-named database. */
  constructor(dbName: string = "ProductivityDb") {
    super(dbName);

    this.version(1).stores({
      appState: "id",
      notes: "id",
    });

    this.version(2)
      .stores({
        appState: "id",
        notes: "id",
        workspace: "id",
      })
      .upgrade(async (tx) => {
        const legacy = await tx.table("appState").get("current");
        if (!legacy) return; // fresh install, nothing to migrate

        const workspace = wrapLegacyAppState(legacy.data as AppState);
        await tx.table("workspace").put({ id: "current", data: workspace });
        // The v1 "appState" row is deliberately left in place as a rollback snapshot.
      });
  }
}

export const db = new ProductivityDb();
