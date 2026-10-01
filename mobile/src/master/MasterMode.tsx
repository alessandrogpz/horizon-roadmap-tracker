// Whether the app is showing one track or all of them.
//
// A mode rather than a screen, which is the whole idea: All tracks is the same
// four tabs you already know — My Space, Today, Plan, Progress — with every
// track folded into each of them and nothing editable. It used to be one long
// screen of its own, which meant learning a second layout to answer questions
// the first layout already had places for.
//
// The flag lives in the device's settings blob, the same one the website uses,
// so a phone and a laptop each remember which way they were last looked at.
// Which track is *active* is workspace data and syncs; which of the two ways
// of looking at the workspace you last used is this device's own business.
//
// Held in a provider as well, because `@shared/settings` is read synchronously
// and has no subscription a phone can use — the website listens on `window`,
// which React Native does not have in any useful form. The provider is the
// subscription.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getSettings, updateSettings } from "@shared/settings";

interface MasterModeValue {
  /** All tracks at once, read-only. */
  master: boolean;
  setMaster: (on: boolean) => void;
  /** Track ids left out of the view. Kept here too so a change repaints every
   *  tab rather than only the one that made it. */
  excluded: string[];
  toggleTrack: (trackId: string) => void;
}

const MasterModeContext = createContext<MasterModeValue | null>(null);

export function useMasterMode(): MasterModeValue {
  const value = useContext(MasterModeContext);
  if (!value) throw new Error("useMasterMode must be used inside MasterModeProvider");
  return value;
}

export function MasterModeProvider({ children }: { children: React.ReactNode }) {
  const [master, setMasterState] = useState(() => getSettings().masterView);
  const [excluded, setExcluded] = useState<string[]>(() => getSettings().masterExcluded);

  const setMaster = useCallback((on: boolean) => {
    setMasterState(on);
    updateSettings({ masterView: on });
  }, []);

  const toggleTrack = useCallback((trackId: string) => {
    setExcluded((current) => {
      const next = current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId];
      updateSettings({ masterExcluded: next });
      return next;
    });
  }, []);

  const value = useMemo<MasterModeValue>(
    () => ({ master, setMaster, excluded, toggleTrack }),
    [excluded, master, setMaster, toggleTrack]
  );

  return <MasterModeContext.Provider value={value}>{children}</MasterModeContext.Provider>;
}
