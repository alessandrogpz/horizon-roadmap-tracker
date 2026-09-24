// The browser build of this app has no business writing backups.
//
// Metro picks this file over backupFile.ts on web, on the `.web.ts` extension
// — the same mechanism as ../storage/db.web.ts. The reason is the same too:
// the browser already has a first-class Horizon in the Next.js app, whose
// Settings does exports properly (a .json *and* a .zip of readable .md files,
// from IndexedDB). Reimplementing half of that against localStorage, in a
// build that exists to develop the phone app against, would be duplicated
// work with a worse result.
//
// So the calls exist and refuse, which keeps the Settings screen compiling and
// tells anyone who taps the button where the feature actually lives.

import {
  summarizeBackup,
  InvalidBackupError,
  type BackupBundle,
  type BackupSummary,
} from "@shared/backupFormat";

export { InvalidBackupError, summarizeBackup };
export type { BackupBundle, BackupSummary };

export class CancelledError extends Error {}

const NOT_HERE = "Backups are on the website — it holds the full copy this build reads from.";

export async function buildBackupBundle(): Promise<BackupBundle> {
  throw new Error(NOT_HERE);
}

export async function exportBackup(): Promise<string> {
  throw new Error(NOT_HERE);
}

export async function readBackupToRestore(): Promise<BackupBundle> {
  throw new Error(NOT_HERE);
}

export async function restoreBackup(_bundle: BackupBundle) {
  throw new Error(NOT_HERE);
}
