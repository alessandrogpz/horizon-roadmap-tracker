import { zipSync, strToU8 } from "fflate";
import { fetchWorkspace } from "./api";
import { db } from "./localDb";
import type { Workspace } from "./types";

export interface BackupBundle {
  exportedAt: string;
  version: 1;
  workspace: Workspace;
  /** materialId -> note markdown content */
  notes: Record<string, string>;
}

async function buildBackupBundle(): Promise<BackupBundle> {
  const workspace = await fetchWorkspace();
  const noteRecords = await db.notes.toArray();
  const notes: Record<string, string> = {};
  noteRecords.forEach((n) => {
    notes[n.id] = n.content;
  });
  return { exportedAt: new Date().toISOString(), version: 1, workspace, notes };
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Turns arbitrary user text into a safe, lowercase filename fragment. */
function slugify(text: string, fallback: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/**
 * A single JSON file with everything the app syncs: every track (phases,
 * schedule, materials, portfolio, rotations, each rotation's full-plan
 * explanation, each track's own roadmap) plus every material's note.
 * Human-readable, no new format to learn — the same shape already synced
 * to Drive as database.json, with notes folded in.
 */
export async function exportSingleFile(): Promise<void> {
  const bundle = await buildBackupBundle();
  const json = JSON.stringify(bundle, null, 2);
  triggerDownload(new Blob([json], { type: "application/json" }), `horizon-backup-${dateStamp()}.json`);
}

/**
 * A .zip with database.json (the same full bundle) plus every roadmap,
 * rotation plan, and material note broken out as its own readable .md file
 * — for browsing/reading individual documents without touching the JSON.
 */
export async function exportZipBundle(): Promise<void> {
  const bundle = await buildBackupBundle();
  const files: Record<string, Uint8Array> = {
    "database.json": strToU8(JSON.stringify(bundle, null, 2)),
  };

  const usedPaths = new Set<string>();
  const addFile = (dir: string, label: string, id: string, content: string) => {
    const base = slugify(label, id);
    let path = `${dir}/${base}.md`;
    if (usedPaths.has(path)) path = `${dir}/${base}-${id.slice(0, 8)}.md`;
    usedPaths.add(path);
    files[path] = strToU8(content);
  };

  Object.values(bundle.workspace.tracks).forEach((track) => {
    if (track.roadmapContent?.trim()) {
      addFile("roadmaps", track.meta.name, track.meta.id, track.roadmapContent);
    }
    (track.rotations || []).forEach((rotation) => {
      if (rotation.explanation?.trim()) {
        addFile("rotations", `${track.meta.name}-${rotation.label}`, rotation.id, rotation.explanation);
      }
    });
    track.materials.forEach((material) => {
      const content = bundle.notes[material.id];
      if (content?.trim()) {
        addFile("notes", `${track.meta.name}-${material.title}`, material.id, content);
      }
    });
  });

  const zipped = zipSync(files, { level: 6 });
  triggerDownload(new Blob([zipped as BlobPart], { type: "application/zip" }), `horizon-backup-${dateStamp()}.zip`);
}
