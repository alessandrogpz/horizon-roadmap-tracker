import Dexie, { type Table } from "dexie";
import type { AppState } from "./types";

export interface AppStateRecord {
  id: string;
  data: AppState;
}

export interface NoteRecord {
  id: string; // materialId
  content: string;
  updatedAt: number;
}

class ProductivityDb extends Dexie {
  appState!: Table<AppStateRecord>;
  notes!: Table<NoteRecord>;

  constructor() {
    super("ProductivityDb");
    this.version(1).stores({
      appState: "id",
      notes: "id",
    });
  }
}

export const db = new ProductivityDb();
