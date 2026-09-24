"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readNote, saveNotes } from "@/lib/notes";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

export type QuickNoteSaveState = "idle" | "saving" | "saved" | "error";

/**
 * A track's notepad or to-do list (lib/quickNotes.ts): loads it, saves
 * edits after `saveDelayMs`, and re-reads it whenever an account sync or a
 * restore lands. These panels stay mounted across a sync, so without that
 * re-read an open panel would save its stale copy over newer content just
 * pulled from another device. The one exception is an edit still waiting to
 * be written: that is the newest version, so it's saved instead.
 *
 * `id` must stay fixed for the component's lifetime — mount it with
 * `key={id}` — so an edit still waiting when the track changes is written to
 * the note it was typed into, not the next track's.
 */
export function useQuickNote(id: string, saveDelayMs: number) {
  const { workspace } = useWorkspace();
  const syncStamp = workspace?.lastSyncTime ?? 0;

  /** null while the first read is in flight. */
  const [content, setContent] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<QuickNoteSaveState>("idle");
  const latest = useRef("");
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Writes a waiting edit now, if there is one. */
  const flush = useCallback(async () => {
    if (!pending.current) return;
    clearTimeout(pending.current);
    pending.current = null;
    setSaveState("saving");
    try {
      await saveNotes(id, latest.current);
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setSaveState("error");
    }
  }, [id]);

  const update = useCallback(
    (next: string) => {
      latest.current = next;
      setContent(next);
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void flush(), saveDelayMs);
    },
    [flush, saveDelayMs]
  );

  useEffect(() => {
    if (pending.current) {
      void flush();
      return;
    }
    let cancelled = false;
    readNote(id).then((stored) => {
      if (cancelled || pending.current) return;
      latest.current = stored;
      setContent(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [id, syncStamp, flush]);

  // Don't lose the last few keystrokes to a closed tab or an unmounted panel.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  return { content, update, flush, saveState };
}
