import type { AppState, CompletedItem, DayCompletions, Material, PortfolioProject, TrackState, Workspace } from "./types";
import { completedItemTitle, rebuildStreakHistory } from "./streak";

const isUrl = (s: string | undefined): boolean =>
  typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"));

/**
 * Per-material merge: whichever side was edited more recently (per-item
 * `updatedAt`) wins the whole record, so an edit on one device can never be
 * silently reverted by a stale value from the other. A real URL (http/https)
 * always beats a local path for the `link` field regardless of recency, since
 * that reflects genuinely better data rather than a race.
 *
 * Legacy materials with no `updatedAt` on either side (never touched by an
 * updatedAt-aware edit) fall back to the old field-by-field, remote-favoring
 * merge so existing data doesn't change behavior.
 */
export const mergeMaterials = (localMats: Material[] = [], remoteMats: Material[] = []): Material[] => {
  const byId = new Map<string, Material>();
  localMats.forEach((m) => byId.set(m.id, { ...m }));
  remoteMats.forEach((rm) => {
    const lm = byId.get(rm.id);
    if (!lm) {
      byId.set(rm.id, { ...rm });
      return;
    }

    const preferRemoteLink = isUrl(rm.link) && !isUrl(lm.link);
    const preferLocalLink = isUrl(lm.link) && !isUrl(rm.link);
    const preferredLink = preferLocalLink ? lm.link : (preferRemoteLink ? rm.link : undefined);

    const localTime = lm.updatedAt || 0;
    const remoteTime = rm.updatedAt || 0;

    if (localTime !== remoteTime) {
      const winner = localTime > remoteTime ? lm : rm;
      byId.set(rm.id, {
        ...winner,
        link: preferredLink ?? winner.link,
        localPath: rm.localPath || lm.localPath,
      });
    } else {
      byId.set(rm.id, {
        ...lm,
        title: rm.title || lm.title,
        category: rm.category || lm.category,
        type: rm.type || lm.type,
        status: rm.status || lm.status,
        totalPages: rm.totalPages || lm.totalPages,
        currentPage: rm.currentPage ?? lm.currentPage,
        currentSubject: rm.currentSubject || lm.currentSubject,
        link: preferredLink ?? (rm.link || lm.link),
        localPath: rm.localPath || lm.localPath,
        // Only when one side actually has one. Writing the key as `undefined`
        // would store it as null (see splitWorkspace's note on BSON), and a
        // material that never had a timestamp shouldn't gain a null one.
        ...(rm.updatedAt || lm.updatedAt ? { updatedAt: rm.updatedAt || lm.updatedAt } : {}),
      });
    }
  });
  return Array.from(byId.values());
};

/** For portfolio, prefer whichever device has a repo URL. */
export const mergePortfolio = (localPort: PortfolioProject[] = [], remotePort: PortfolioProject[] = []): PortfolioProject[] => {
  const byId = new Map<string, PortfolioProject>();
  localPort.forEach((p) => byId.set(p.id, { ...p }));
  remotePort.forEach((rp) => {
    const lp = byId.get(rp.id);
    if (!lp) {
      byId.set(rp.id, { ...rp });
    } else {
      const preferRemoteRepo = isUrl(rp.repoUrl) && !isUrl(lp.repoUrl);
      byId.set(rp.id, {
        ...lp,
        ...rp,
        repoUrl: preferRemoteRepo ? rp.repoUrl : (lp.repoUrl || rp.repoUrl),
      });
    }
  });
  return Array.from(byId.values());
};

export interface MergeOutcome<T = AppState> {
  data: T;
  log: string[];
}

/** Whether an item should end up present after merging two sides' timestamps.
 *  Newer timestamp wins outright; with no timestamp on either side (legacy
 *  data predating itemUpdatedAt/historyUpdatedAt) or an exact tie, presence
 *  on either side wins so neither device's completion is silently dropped. */
const lwwPresent = (localTs: number, remoteTs: number, localPresent: boolean, remotePresent: boolean): boolean => {
  if (localTs !== remoteTs) return localTs > remoteTs ? localPresent : remotePresent;
  return localPresent || remotePresent;
};

/**
 * Per-item last-write-wins merge of a completion id set for one day (tasks or
 * revisions), keyed by `${prefix}${id}` in the timestamp maps. Two devices
 * completing different items on the same day both survive the merge, since
 * the decision is made per item rather than for the whole day at once.
 */
const mergeCompletionIds = (
  localIds: string[],
  remoteIds: string[],
  localTs: Record<string, number>,
  remoteTs: Record<string, number>,
  prefix: string
): { ids: string[]; ts: Record<string, number> } => {
  const allIds = new Set(localIds);
  remoteIds.forEach((id) => allIds.add(id));
  Object.keys(localTs).forEach((k) => k.startsWith(prefix) && allIds.add(k.slice(prefix.length)));
  Object.keys(remoteTs).forEach((k) => k.startsWith(prefix) && allIds.add(k.slice(prefix.length)));

  const ids: string[] = [];
  const ts: Record<string, number> = {};
  allIds.forEach((id) => {
    const key = `${prefix}${id}`;
    const lt = localTs[key] || 0;
    const rt = remoteTs[key] || 0;
    if (lwwPresent(lt, rt, localIds.includes(id), remoteIds.includes(id))) ids.push(id);
    if (lt || rt) ts[key] = Math.max(lt, rt);
  });
  return { ids, ts };
};

/** Same per-item LWW as mergeCompletionIds, but for completedItemsHistory
 *  (keyed by accomplishment title, which also covers material/portfolio
 *  completions that never have a weeklyCompletions id at all). */
const mergeHistoryItems = (
  localItems: CompletedItem[],
  remoteItems: CompletedItem[],
  localTs: Record<string, number>,
  remoteTs: Record<string, number>
): { items: CompletedItem[]; ts: Record<string, number> } => {
  const localTitles = localItems.map(completedItemTitle);
  const remoteTitles = remoteItems.map(completedItemTitle);
  const allTitles = new Set([...localTitles, ...remoteTitles, ...Object.keys(localTs), ...Object.keys(remoteTs)]);

  const items: CompletedItem[] = [];
  const ts: Record<string, number> = {};
  allTitles.forEach((title) => {
    const lt = localTs[title] || 0;
    const rt = remoteTs[title] || 0;
    const localPresent = localTitles.includes(title);
    const remotePresent = remoteTitles.includes(title);
    if (lwwPresent(lt, rt, localPresent, remotePresent)) {
      const source = localPresent
        ? localItems.find((it) => completedItemTitle(it) === title)
        : remoteItems.find((it) => completedItemTitle(it) === title);
      items.push(source ?? title);
    }
    if (lt || rt) ts[title] = Math.max(lt, rt);
  });
  return { items, ts };
};

/**
 * Merge the local state with a remote (Google Drive) backup.
 *
 * Progress (weeklyCompletions / completedItemsHistory) is merged per-item
 * using itemUpdatedAt/historyUpdatedAt last-toggle timestamps, so two devices
 * that complete different items on the same day both keep their change —
 * neither side's whole day clobbers the other's. Structural config follows
 * the higher configVersion. Pure function — no I/O.
 *
 * Generic over T (AppState, or TrackState which is AppState plus track
 * identity) so mergeWorkspace below can reuse this exact per-track merge
 * primitive without duplicating it.
 */
export function mergeAppState<T extends AppState>(localData: T, remoteData: T): MergeOutcome<T> {
  const log: string[] = [];

  const mergedWeeklyCompletions: Record<string, DayCompletions> = {};
  const mergedItemUpdatedAt: Record<string, Record<string, number>> = {};
  const compDates = Array.from(new Set([
    ...Object.keys(localData.weeklyCompletions || {}),
    ...Object.keys(remoteData.weeklyCompletions || {}),
    ...Object.keys(localData.itemUpdatedAt || {}),
    ...Object.keys(remoteData.itemUpdatedAt || {}),
  ]));
  compDates.forEach((date) => {
    const localComps = localData.weeklyCompletions?.[date] || { tasks: [], revisions: [] };
    const remoteComps = remoteData.weeklyCompletions?.[date] || { tasks: [], revisions: [] };
    const localTs = localData.itemUpdatedAt?.[date] || {};
    const remoteTs = remoteData.itemUpdatedAt?.[date] || {};

    const tasksResult = mergeCompletionIds(localComps.tasks || [], remoteComps.tasks || [], localTs, remoteTs, "t:");
    const revsResult = mergeCompletionIds(localComps.revisions || [], remoteComps.revisions || [], localTs, remoteTs, "r:");

    mergedWeeklyCompletions[date] = { tasks: tasksResult.ids, revisions: revsResult.ids };
    mergedItemUpdatedAt[date] = { ...tasksResult.ts, ...revsResult.ts };
  });

  const mergedCompletedItemsHistory: Record<string, CompletedItem[]> = {};
  const mergedHistoryUpdatedAt: Record<string, Record<string, number>> = {};
  const histDates = Array.from(new Set([
    ...Object.keys(localData.completedItemsHistory || {}),
    ...Object.keys(remoteData.completedItemsHistory || {}),
    ...Object.keys(localData.historyUpdatedAt || {}),
    ...Object.keys(remoteData.historyUpdatedAt || {}),
  ]));
  histDates.forEach((date) => {
    const { items, ts } = mergeHistoryItems(
      localData.completedItemsHistory?.[date] || [],
      remoteData.completedItemsHistory?.[date] || [],
      localData.historyUpdatedAt?.[date] || {},
      remoteData.historyUpdatedAt?.[date] || {}
    );
    mergedCompletedItemsHistory[date] = items;
    mergedHistoryUpdatedAt[date] = ts;
  });

  const localConfigVer = localData.configVersion || 0;
  const remoteConfigVer = remoteData.configVersion || 0;

  // For structural config (phase info, startDate, weekSchedule etc) pick the higher configVersion side
  const configBase = remoteConfigVer > localConfigVer ? remoteData : localData;

  let finalData: AppState = {
    ...configBase,
    // Always use smart-merged materials & portfolio
    materials: mergeMaterials(localData.materials, remoteData.materials),
    portfolio: mergePortfolio(localData.portfolio, remoteData.portfolio),
    // Always use merged progress data
    weeklyCompletions: mergedWeeklyCompletions,
    streakHistory: rebuildStreakHistory(mergedCompletedItemsHistory),
    completedItemsHistory: mergedCompletedItemsHistory,
    itemUpdatedAt: mergedItemUpdatedAt,
    historyUpdatedAt: mergedHistoryUpdatedAt,
    hasUnsyncedChanges: false,
    lastSyncTime: Date.now(),
    isSynced: true,
    // Normalise configVersion so both sides start from same baseline after sync
    configVersion: Math.max(localConfigVer, remoteConfigVer),
  };

  if (remoteConfigVer > localConfigVer) {
    log.push("Remote configuration is newer. Adopting remote structural config.");
  } else if (localConfigVer > remoteConfigVer) {
    log.push("Local configuration is newer. Keeping local structural config.");
  } else {
    // If versions are equal, fallback to reset date logic for daily structure
    const localReset = localData.lastTasksResetDate || "";
    const remoteReset = remoteData.lastTasksResetDate || "";
    if (remoteReset > localReset) {
      log.push("Remote timeline has newer checklist reset. Adopting remote daily structure.");
      finalData = {
        ...finalData,
        dailyTasks: remoteData.dailyTasks,
        dailyRevisionItems: remoteData.dailyRevisionItems,
        lastTasksResetDate: remoteReset,
      };
    }
  }

  return { data: finalData as T, log };
}

export interface WorkspaceMergeOutcome {
  data: Workspace;
  log: string[];
}

/**
 * Extends the per-track merge to a whole Workspace: runs mergeAppState once
 * per track present on both sides. A track present on only one side always
 * survives the merge as-is — it's treated as "not yet synced there," never
 * as "deleted there." (Real cross-device deletion would need an explicit
 * tombstone via TrackMeta.archived; not implemented here.)
 */
export function mergeWorkspace(local: Workspace, remote: Workspace): WorkspaceMergeOutcome {
  const log: string[] = [];
  const localTracks = local.tracks || {};
  const remoteTracks = remote.tracks || {};
  const allTrackIds = Array.from(new Set([...Object.keys(localTracks), ...Object.keys(remoteTracks)]));
  const mergedTracks: Record<string, TrackState> = {};

  allTrackIds.forEach((id) => {
    const l = localTracks[id];
    const r = remoteTracks[id];
    if (l && r) {
      const { data, log: trackLog } = mergeAppState(l, r);
      mergedTracks[id] = data;
      log.push(`Track "${l.meta.name}": ${trackLog.join(" ")}`);
    } else if (l) {
      mergedTracks[id] = l;
      log.push(`Track "${l.meta.name}": local-only, kept as-is.`);
    } else if (r) {
      mergedTracks[id] = r;
      log.push(`Track "${r.meta.name}": adopted from remote (new track).`);
    }
  });

  const activeTrackId =
    local.activeTrackId && mergedTracks[local.activeTrackId]
      ? local.activeTrackId
      : remote.activeTrackId && mergedTracks[remote.activeTrackId]
        ? remote.activeTrackId
        : Object.keys(mergedTracks)[0] || "";

  return {
    data: {
      // Dashboard layout is per-track now (each track's panelColumns/hiddenPanels
      // ride its own configVersion via mergeAppState), so there's no
      // workspace-level layout to reconcile here anymore.
      activeTrackId,
      tracks: mergedTracks,
      // Both sides were migrated before merging, so keep the higher stamp
      // rather than letting an older device's number undo the other's steps.
      schemaVersion: Math.max(local.schemaVersion ?? 0, remote.schemaVersion ?? 0),
      isSynced: true,
      hasUnsyncedChanges: false,
      lastSyncTime: Date.now(),
    },
    log,
  };
}
