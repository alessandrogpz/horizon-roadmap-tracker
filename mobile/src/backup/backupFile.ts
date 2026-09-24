// Backups on the phone: writing one out, and reading one back in.
//
// The file is the same file the website writes — same JSON, same name — which
// is the entire point. A backup taken on the laptop restores here, and one
// taken here opens on the laptop. `@shared/backupFormat` holds the shape and
// the validation so there is one parser rather than two that drift.
//
// What is different is how a file gets in and out, and on Android that is not
// a detail. An app cannot write into the user's storage and cannot read from
// it; it can only ask the system to hand it a location the *user* picked. That
// is the Storage Access Framework, and it is the reason the export asks for a
// folder and the import opens the system picker rather than either one naming
// a path. The app never gains access to anything else, and the permission
// lasts exactly one file — there is no "allow storage" prompt because there is
// no storage permission involved.
//
// All of this comes from expo-file-system, which is already part of every Expo
// app. A dedicated document picker and a share-sheet module would each have
// been a native dependency, and a native dependency means a new build in
// everyone's hands rather than an over-the-air update.

import { Directory, File } from "expo-file-system";
import { migrateWorkspace } from "@shared/migrations";
import {
  backupFilename,
  parseBackup,
  summarizeBackup,
  InvalidBackupError,
  type BackupBundle,
  type BackupSummary,
} from "@shared/backupFormat";
import { loadNotes, loadWorkspace, replaceNotes, saveWorkspace } from "../storage/db";

export { InvalidBackupError, summarizeBackup };
export type { BackupBundle, BackupSummary };

/** Dismissing the system picker is a decision, not a failure — it must not
 *  surface as an error, and it must be told apart from one. */
export class CancelledError extends Error {}

/**
 * Everything this device holds, in the website's export format.
 *
 * Step counts are deliberately absent, for the same reason they are absent
 * from sync: they are a reading from this particular phone's hardware and mean
 * nothing anywhere else.
 */
export async function buildBackupBundle(): Promise<BackupBundle> {
  const workspace = await loadWorkspace();
  if (!workspace) throw new Error("There is nothing stored on this phone yet.");
  const notes: Record<string, string> = {};
  (await loadNotes()).forEach((note) => {
    notes[note.id] = note.content;
  });
  return { exportedAt: new Date().toISOString(), version: 1, workspace, notes };
}

/**
 * Asks for a folder and writes the backup into it. Returns the file's name, so
 * the screen can say what was written rather than only that something was.
 *
 * The folder is whatever the user picks — Downloads, a Drive folder, an SD
 * card. Horizon has no say in it and no access to it afterwards.
 */
export async function exportBackup(): Promise<string> {
  const bundle = await buildBackupBundle();
  const json = JSON.stringify(bundle, null, 2);

  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    // The only expected rejection is the user backing out of the folder
    // picker. Anything else is a genuine failure and has to stay visible
    // rather than being reported as "you cancelled".
    if (isPickerCancelled(error)) throw new CancelledError();
    throw error;
  }

  const name = backupFilename("json");
  const file = directory.createFile(name, "application/json");
  file.write(json);
  return name;
}

/**
 * Opens the system file picker and reads whatever comes back.
 *
 * `.json` only: the website also exports a `.zip`, but unzipping it would mean
 * bundling a decompressor for a format the phone cannot produce in the first
 * place. The JSON export holds exactly the same data — the .md files in the
 * zip are copies of content already inside database.json — so the message says
 * which one to take rather than pretending the zip is unsupported by accident.
 *
 * The file is parsed and described, not applied. Restoring replaces
 * everything, so the caller shows the summary and asks first.
 */
export async function readBackupToRestore(): Promise<BackupBundle> {
  // Android filters the picker by MIME type, and a .json file in Downloads is
  // very often served as application/octet-stream by whichever app wrote it —
  // filter on application/json alone and the backup is simply not in the list.
  // Widening it costs nothing: the parser validates whatever comes back.
  const picked = await File.pickFileAsync({
    mimeTypes: ["application/json", "application/octet-stream", "text/plain"],
  });
  // `pickFileAsync` turns *every* rejection into `canceled`, a real failure
  // included, so there is nothing more specific to tell the user here.
  if (picked.canceled || !picked.result) throw new CancelledError();
  const file = picked.result;

  if (file.name?.toLowerCase().endsWith(".zip")) {
    throw new InvalidBackupError(
      "That's the .zip export. Take the .json one — it holds the same data, and the phone can read it."
    );
  }
  return parseBackup(await file.text());
}

/**
 * Replaces this device's workspace and notes with the backup's.
 *
 * Replace, not merge — the same decision the website makes, for the same
 * reason: a restore means "put it back the way it was", and a merge would need
 * per-item timestamps the file may predate. The workspace goes through the
 * shared migration pipeline on the way in, so a backup written by an older
 * version lands at the current schema.
 *
 * Returns the migrated workspace, which the caller hands to the provider —
 * what is on screen has to change with what is in storage, or the next edit
 * writes the old workspace straight back over the new one.
 */
export async function restoreBackup(bundle: BackupBundle) {
  const { workspace } = migrateWorkspace(bundle.workspace);
  const now = Date.now();

  await saveWorkspace(workspace);
  await replaceNotes(
    Object.entries(bundle.notes ?? {}).map(([id, content]) => ({ id, content, updatedAt: now }))
  );
  return workspace;
}

/** Expo raises a coded exception when someone backs out of the system picker.
 *  Matching the code rather than the message keeps this working if the wording
 *  changes; the message is checked too, in case the code does not survive the
 *  bridge. */
function isPickerCancelled(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  const message = (error as { message?: string } | null)?.message ?? "";
  return code === "ERR_PICKER_CANCELLED" || /cancel/i.test(`${code} ${message}`);
}
