// The track's training log, read from and written back to its note.
//
// The log lives in a note (`@shared/gym` explains why), so the usual note
// rules apply: read it once on open, write the whole thing on every change,
// and let sync merge per note by timestamp. Two phones logging different
// sessions on the same day resolve to whichever wrote last — the same answer
// the notepad gives, and the right one for something only ever edited in one
// place at a time.

import { useCallback, useEffect, useState } from "react";
import { emptyGymLog, gymNoteId, parseGymLog, serializeGymLog, type GymLog } from "@shared/gym";
import { loadNotes, saveNote } from "../storage/db";

export function useGymLog(trackId: string | undefined | null) {
  const [log, setLog] = useState<GymLog>(emptyGymLog);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    setLoaded(false);
    loadNotes().then((notes) => {
      if (cancelled) return;
      setLog(parseGymLog(notes.find((note) => note.id === gymNoteId(trackId))?.content));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  /** Applies a change and writes it immediately — there is no "save" moment in
   *  a gym, and Android can end the process between sets. */
  const change = useCallback(
    (next: (log: GymLog) => GymLog) => {
      if (!trackId) return;
      setLog((current) => {
        const updated = next(current);
        void saveNote({
          id: gymNoteId(trackId),
          content: serializeGymLog(updated),
          updatedAt: Date.now(),
        });
        return updated;
      });
    },
    [trackId]
  );

  return { log, loaded, change };
}
