import type { AppState, CompletedItem, DayCompletions, Material, PortfolioProject, TrackState, Workspace } from "./types";
import { completedItemTitle, rebuildStreakHistory } from "./streak";

const isUrl = (s: string | undefined): boolean =>
  typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"));

/**
 * Per-material merge: always prefer a real URL (http/https) over a local path.
 * This ensures link edits on any device win regardless of inflated configVersion.
 */
export const mergeMaterials = (localMats: Material[] = [], remoteMats: Material[] = []): Material[] => {
  const byId = new Map<string, Material>();
  localMats.forEach((m) => byId.set(m.id, { ...m }));
  remoteMats.forEach((rm) => {
    const lm = byId.get(rm.id);
    if (!lm) {
      byId.set(rm.id, { ...rm });
    } else {
      // Prefer real URL over local path for link field
      const preferRemoteLink = isUrl(rm.link) && !isUrl(lm.link);
      const preferLocalLink = isUrl(lm.link) && !isUrl(rm.link);
      byId.set(rm.id, {
        ...lm,
        // Adopt all remote scalar fields unless local clearly has a better link
        title: rm.title || lm.title,
        category: rm.category || lm.category,
        type: rm.type || lm.type,
        status: rm.status || lm.status,
        totalPages: rm.totalPages || lm.totalPages,
        currentPage: rm.currentPage ?? lm.currentPage,
        currentSubject: rm.currentSubject || lm.currentSubject,
        link: preferLocalLink ? lm.link : (preferRemoteLink ? rm.link : (rm.link || lm.link)),
        localPath: rm.localPath || lm.localPath,
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

/**
 * Merge the local state with a remote (Google Drive) backup.
 *
 * Progress (weeklyCompletions / completedItemsHistory) is merged per-day using
 * the lastUpdatedDates edit counters: the higher counter wins the day; on ties,
 * deletions win over additions, otherwise a union is taken. Structural config
 * follows the higher configVersion. Pure function — no I/O.
 *
 * Generic over T (AppState, or TrackState which is AppState plus track
 * identity) so mergeWorkspace below can reuse this exact per-track merge
 * primitive without duplicating it.
 */
export function mergeAppState<T extends AppState>(localData: T, remoteData: T): MergeOutcome<T> {
  const log: string[] = [];

  const mergedWeeklyCompletions: Record<string, DayCompletions> = { ...(localData.weeklyCompletions || {}) };
  const mergedCompletedItemsHistory: Record<string, CompletedItem[]> = { ...(localData.completedItemsHistory || {}) };

  const localUpdated = localData.lastUpdatedDates || {};
  const remoteUpdated = remoteData.lastUpdatedDates || {};
  const mergedUpdated = { ...localUpdated, ...remoteUpdated };

  const allDates = Array.from(new Set([
    ...Object.keys(localUpdated),
    ...Object.keys(remoteUpdated),
    ...Object.keys(localData.weeklyCompletions || {}),
    ...Object.keys(remoteData.weeklyCompletions || {}),
    ...Object.keys(localData.completedItemsHistory || {}),
    ...Object.keys(remoteData.completedItemsHistory || {})
  ]));

  allDates.forEach((date) => {
    const localTime = localUpdated[date] || 0;
    const remoteTime = remoteUpdated[date] || 0;

    if (remoteTime > localTime) {
      // Remote is newer: adopt remote completions and achievements for this day
      if (remoteData.weeklyCompletions?.[date]) {
        mergedWeeklyCompletions[date] = remoteData.weeklyCompletions[date];
      } else {
        delete mergedWeeklyCompletions[date];
      }

      if (remoteData.completedItemsHistory?.[date]) {
        mergedCompletedItemsHistory[date] = remoteData.completedItemsHistory[date];
      } else {
        delete mergedCompletedItemsHistory[date];
      }
    } else if (localTime > remoteTime) {
      // Local is newer: keep local completions (already in the merged maps)
    } else {
      // Equal versions: deletion wins over addition
      const remoteTaskCount = (remoteData.weeklyCompletions?.[date]?.tasks || []).length;
      const localTaskCount = (mergedWeeklyCompletions[date]?.tasks || []).length;
      const remoteRevCount = (remoteData.weeklyCompletions?.[date]?.revisions || []).length;
      const localRevCount = (mergedWeeklyCompletions[date]?.revisions || []).length;

      if (remoteTaskCount < localTaskCount || remoteRevCount < localRevCount) {
        // Remote deleted something, adopt remote
        mergedWeeklyCompletions[date] = remoteData.weeklyCompletions?.[date] || { tasks: [], revisions: [] };
        mergedCompletedItemsHistory[date] = remoteData.completedItemsHistory?.[date] || [];
      } else {
        // Standard union merge for additions
        const remoteComps = remoteData.weeklyCompletions?.[date] || { tasks: [], revisions: [] };
        const localComps = mergedWeeklyCompletions[date] || { tasks: [], revisions: [] };
        mergedWeeklyCompletions[date] = {
          tasks: Array.from(new Set([...(localComps.tasks || []), ...(remoteComps.tasks || [])])),
          revisions: Array.from(new Set([...(localComps.revisions || []), ...(remoteComps.revisions || [])])),
        };

        const localItems = mergedCompletedItemsHistory[date] || [];
        const remoteItems = remoteData.completedItemsHistory?.[date] || [];
        const mergedItems = [...localItems];
        remoteItems.forEach((rIt) => {
          const rTitle = completedItemTitle(rIt);
          const exists = mergedItems.some((lIt) => completedItemTitle(lIt) === rTitle);
          if (!exists) mergedItems.push(rIt);
        });
        mergedCompletedItemsHistory[date] = mergedItems;
      }
    }
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
    lastUpdatedDates: mergedUpdated,
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
      activeTrackId,
      tracks: mergedTracks,
      panelColumns: local.panelColumns || remote.panelColumns,
      isSynced: true,
      hasUnsyncedChanges: false,
      lastSyncTime: Date.now(),
    },
    log,
  };
}
