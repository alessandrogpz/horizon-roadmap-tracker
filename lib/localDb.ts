import Dexie, { type Table } from "dexie";

export interface AppStateRecord {
  id: string;
  data: any;
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
