import { db } from "./localDb";
import type { GitStats, Material, PortfolioProject, RotationDef, TrackId, TrackState, Workspace } from "./types";
import { LEGACY_PATH_TO_REPO, MATERIAL_REPO_MAP, PORTFOLIO_REPO_MAP } from "./migrationConfig";
import { LEGACY_TRACK_ID } from "./localDb";
import { DEFAULT_WEEK_SCHEDULE } from "./constants";

/**
 * migrationConfig.ts's repo maps (m1, p1, ...) were only ever meaningful for
 * the one track created by the pre-multi-track app, so this must never run
 * against any other track — a new track's own material could reuse the id
 * "m1" and must not be silently rewritten.
 */
const migrateLocalPaths = (track: TrackState): { track: TrackState; modified: boolean } => {
  if (track.meta.id !== LEGACY_TRACK_ID) return { track, modified: false };
  let modified = false;

  const migrateEntry = <T extends { id: string; localPath?: string; repoUrl?: string }>(
    entry: T,
    repoMap: Record<string, string>
  ): T => {
    const updated = { ...entry };
    // Convert old local path → GitHub URL in localPath
    if (entry.localPath && LEGACY_PATH_TO_REPO[entry.localPath]) {
      updated.localPath = LEGACY_PATH_TO_REPO[entry.localPath];
      modified = true;
    }
    // Inject repoUrl by ID — always authoritative
    if (repoMap[entry.id] && updated.repoUrl !== repoMap[entry.id]) {
      updated.repoUrl = repoMap[entry.id];
      modified = true;
    }
    return updated;
  };

  const next: TrackState = { ...track };
  if (next.portfolio) {
    next.portfolio = next.portfolio.map((proj: PortfolioProject) => migrateEntry(proj, PORTFOLIO_REPO_MAP));
  }
  if (next.materials) {
    next.materials = next.materials.map((mat: Material) => migrateEntry(mat, MATERIAL_REPO_MAP));
  }

  return { track: next, modified };
};

/**
 * One-time upgrade of the pre-multi-rotation shape (a single rotationConfig
 * + dsaStartWeek, both retired from TrackState) into the general `rotations`
 * list. Only ever touches data synced before this feature existed — every
 * track created since is seeded with `rotations` (or nothing) directly.
 * Splits the old single pattern-vs-interleave rotation into the two
 * rotations it implied, using whatever weekSchedule the track actually has.
 */
const migrateLegacyRotation = (track: TrackState): { track: TrackState; modified: boolean } => {
  const legacy = track as TrackState & {
    rotationConfig?: { weeks: { pattern: string; problems: string }[]; appliesToScheduleType: string };
    dsaStartWeek?: number;
  };
  if (!legacy.rotationConfig) return { track, modified: false };

  const startWeek = legacy.dsaStartWeek || 1;
  const schedule = track.weekSchedule || DEFAULT_WEEK_SCHEDULE;
  const ALL_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const patternDays = schedule.filter((d) => d.type === legacy.rotationConfig!.appliesToScheduleType).map((d) => d.name);
  const interleaveDays = ALL_WEEKDAYS.filter((d) => !patternDays.includes(d));

  const rotations: RotationDef[] = [
    {
      id: "legacy_pattern_rotation",
      label: "Weekly Algorithm",
      items: legacy.rotationConfig.weeks.map((w) => ({ title: w.pattern, description: w.problems })),
      daysOfWeek: patternDays,
      target: "revision",
      startWeek,
    },
  ];
  if (interleaveDays.length > 0) {
    rotations.push({
      id: "legacy_math_interleave",
      label: "Linear Algebra",
      items: [{ title: "Linear Algebra", description: "Practice vector spaces, transforms, and equations" }],
      daysOfWeek: interleaveDays,
      target: "revision",
      startWeek: 1,
    });
  }

  const next = { ...legacy, rotations };
  delete next.rotationConfig;
  delete next.dsaStartWeek;
  return { track: next, modified: true };
};

/** Per-track edit-counter/config-version bookkeeping — the same algorithm the
 *  app has always used, just scoped to one track's slice instead of the
 *  whole saved record. Drives lib/merge.ts's day-level and structural merge. */
const applyTrackBookkeeping = (
  oldTrack: TrackState | undefined,
  newTrack: TrackState,
  isReset: boolean
): { track: TrackState; changed: boolean } => {
  const oldData: Partial<TrackState> = oldTrack || {};
  const lastUpdatedDates: Record<string, number> = { ...(newTrack.lastUpdatedDates || {}) };

  const oldComps = oldData.weeklyCompletions || {};
  const newComps = newTrack.weeklyCompletions || {};
  const allDates = Array.from(new Set([...Object.keys(oldComps), ...Object.keys(newComps)]));

  let hasChanges = false;
  allDates.forEach((date) => {
    const oldVal = oldComps[date] || { tasks: [], revisions: [] };
    const newVal = newComps[date] || { tasks: [], revisions: [] };
    const tasksChanged = JSON.stringify(oldVal.tasks) !== JSON.stringify(newVal.tasks);
    const revsChanged = JSON.stringify(oldVal.revisions) !== JSON.stringify(newVal.revisions);
    if (tasksChanged || revsChanged) {
      lastUpdatedDates[date] = (oldData.lastUpdatedDates?.[date] || 0) + 1;
      hasChanges = true;
    }
  });

  const oldHist = oldData.completedItemsHistory || {};
  const newHist = newTrack.completedItemsHistory || {};
  const allHistDates = Array.from(new Set([...Object.keys(oldHist), ...Object.keys(newHist)]));
  allHistDates.forEach((date) => {
    const oldItems = oldHist[date] || [];
    const newItems = newHist[date] || [];
    if (JSON.stringify(oldItems) !== JSON.stringify(newItems)) {
      lastUpdatedDates[date] = (oldData.lastUpdatedDates?.[date] || 0) + 1;
      hasChanges = true;
    }
  });

  const track: TrackState = { ...newTrack, lastUpdatedDates };

  if (isReset) {
    // System-initiated daily reset: don't bump configVersion, so this save
    // doesn't accidentally win version conflicts against other devices.
    track.configVersion = oldData.configVersion || 0;
    return { track, changed: hasChanges };
  }

  // Targeted comparison of user-editable config fields only.
  const stableJSON = (v: unknown) => JSON.stringify(v);
  const CONFIG_COMPARE_FIELDS = [
    "materials",
    "portfolio",
    "currentPhase",
    "startDate",
    "currentPhaseStartDate",
    "rotations",
    "weekSchedule",
    "roadmapContent",
    "phases",
  ] as const;

  let configChanged = false;
  for (const field of CONFIG_COMPARE_FIELDS) {
    if (stableJSON(oldData[field]) !== stableJSON(newTrack[field])) {
      configChanged = true;
      break;
    }
  }

  track.configVersion = configChanged ? (oldData.configVersion || 0) + 1 : (oldData.configVersion || 0);

  return { track, changed: configChanged || hasChanges };
};

/** Fresh install: an empty workspace, which app/page.tsx treats as "redirect to onboarding". */
const buildEmptyWorkspace = (): Workspace => ({ activeTrackId: "", tracks: {} });

export const fetchWorkspace = async (): Promise<Workspace> => {
  try {
    const record = await db.workspace.get("current");
    if (record) {
      let modified = false;
      const tracks: Record<TrackId, TrackState> = {};
      Object.entries(record.data.tracks).forEach(([id, t]) => {
        const { track: pathsTrack, modified: pathsModified } = migrateLocalPaths(t);
        const { track, modified: rotationModified } = migrateLegacyRotation(pathsTrack);
        tracks[id] = track;
        if (pathsModified || rotationModified) modified = true;
      });
      const data: Workspace = { ...record.data, tracks };
      if (modified) {
        await db.workspace.put({ id: "current", data });
      }
      return data;
    }

    const empty = buildEmptyWorkspace();
    await db.workspace.put({ id: "current", data: empty });
    return empty;
  } catch (error) {
    console.error("fetchWorkspace local error:", error);
    throw error;
  }
};

export const updateWorkspace = async (newWorkspace: Workspace): Promise<{ success: true }> => {
  try {
    const record = await db.workspace.get("current");
    const oldWorkspace = record?.data;
    const isReset = !!newWorkspace.isReset;

    let anyChanged = false;
    const tracks: Record<TrackId, TrackState> = {};
    Object.entries(newWorkspace.tracks).forEach(([id, track]) => {
      const { track: bookkept, changed } = applyTrackBookkeeping(oldWorkspace?.tracks?.[id], track, isReset);
      tracks[id] = bookkept;
      if (changed) anyChanged = true;
    });

    const finalWorkspace: Workspace = { ...newWorkspace, tracks };
    delete finalWorkspace.isReset;

    if (isReset) {
      finalWorkspace.hasUnsyncedChanges = newWorkspace.hasUnsyncedChanges ?? oldWorkspace?.hasUnsyncedChanges ?? false;
    } else if (anyChanged) {
      finalWorkspace.hasUnsyncedChanges = true;
    } else if (finalWorkspace.hasUnsyncedChanges === undefined) {
      finalWorkspace.hasUnsyncedChanges = oldWorkspace?.hasUnsyncedChanges ?? false;
    }

    await db.workspace.put({ id: "current", data: finalWorkspace });
    return { success: true };
  } catch (error) {
    console.error("updateWorkspace local error:", error);
    throw error;
  }
};

export const fetchTrackState = async (trackId: TrackId): Promise<TrackState | null> => {
  const ws = await fetchWorkspace();
  return ws.tracks[trackId] ?? null;
};

export const setActiveTrack = async (trackId: TrackId): Promise<void> => {
  const ws = await fetchWorkspace();
  if (!ws.tracks[trackId]) return;
  await db.workspace.put({ id: "current", data: { ...ws, activeTrackId: trackId } });
};

export const createTrack = async (track: TrackState): Promise<void> => {
  const ws = await fetchWorkspace();
  const nextWorkspace: Workspace = {
    ...ws,
    tracks: { ...ws.tracks, [track.meta.id]: track },
    activeTrackId: track.meta.id,
  };
  await db.workspace.put({ id: "current", data: nextWorkspace });
};

export const deleteTrack = async (trackId: TrackId): Promise<void> => {
  const ws = await fetchWorkspace();
  const remainingIds = Object.keys(ws.tracks).filter((id) => id !== trackId);
  if (remainingIds.length === 0) {
    throw new Error("Cannot delete the last remaining track.");
  }
  const tracks = { ...ws.tracks };
  delete tracks[trackId];
  const activeTrackId = ws.activeTrackId === trackId ? remainingIds[0] : ws.activeTrackId;
  await db.workspace.put({ id: "current", data: { ...ws, tracks, activeTrackId } });
};

export const openLinkOnSystem = async (link: string) => {
  const res = await fetch("/api/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link }),
  });
  if (!res.ok) throw new Error("Failed to open link");
  return res.json();
};

export const fetchGitStats = async (pathOrRepo: string): Promise<GitStats> => {
  // If it's a GitHub repo identifier (e.g. "owner/repo" or a github URL)
  const githubRegex = /(?:github\.com\/|git@github\.com:)([^\/]+)\/([^.\/]+)(?:\.git)?/;
  const match = pathOrRepo.match(githubRegex) || (!pathOrRepo.startsWith("/") && !pathOrRepo.startsWith("~") && pathOrRepo.includes("/") ? [pathOrRepo, ...pathOrRepo.split("/")] : null);

  if (match) {
    const owner = match[1];
    const repo = match[2]?.replace(".git", "");
    const cacheKey = `${owner}/${repo}`;

    // Read from localStorage cache if available
    let storedCache: Record<string, { data: GitStats, timestamp: number }> = {};
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("github_git_stats_cache");
        if (stored) {
          storedCache = JSON.parse(stored);
        }
      } catch {}
    }

    const cachedEntry = storedCache[cacheKey];
    if (cachedEntry) {
      // 15-minute cache lifespan
      const isExpired = Date.now() - cachedEntry.timestamp > 15 * 60 * 1000;
      if (!isExpired) {
        return cachedEntry.data;
      }
    }

    // Optional personal access token raises the GitHub API rate limit from
    // 60 requests/hour (per IP) to 5000/hour. Set it once from the browser
    // console: localStorage.setItem("github_token", "<token>")
    const githubToken = typeof window !== "undefined" ? localStorage.getItem("github_token") || "" : "";
    const githubHeaders: Record<string, string> = githubToken ? { Authorization: `Bearer ${githubToken}` } : {};

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: githubHeaders });

      if (repoRes.status === 403) {
        console.warn(`GitHub API rate limited for ${cacheKey}. Stats unavailable until the limit resets.`);
        // Fall back to expired cache if available so UI doesn't break
        if (cachedEntry) {
          console.log(`Using rate-limited expired cache fallback for ${cacheKey}`);
          return cachedEntry.data;
        }
        return { isRepo: false, rateLimited: true };
      }
      if (repoRes.status === 404) {
        return { isRepo: false };
      }
      if (!repoRes.ok) {
        console.warn(`GitHub API returned ${repoRes.status} for ${cacheKey}`);
        if (cachedEntry) return cachedEntry.data;
        return { isRepo: false };
      }

      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || "main";

      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers: githubHeaders });
      if (!commitRes.ok) {
        const result = {
          isRepo: true,
          branch: defaultBranch,
          uncommittedCount: 0,
          lastCommitMsg: "",
          lastCommitTime: "",
        };
        // Update cache
        if (typeof window !== "undefined") {
          try {
            storedCache[cacheKey] = { data: result, timestamp: Date.now() };
            localStorage.setItem("github_git_stats_cache", JSON.stringify(storedCache));
          } catch {}
        }
        return result;
      }
      const commits = await commitRes.json();
      const lastCommit = commits[0];

      let relativeTime = "";
      if (lastCommit?.commit?.author?.date) {
        const commitDate = new Date(lastCommit.commit.author.date);
        const diffMs = Date.now() - commitDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) relativeTime = "today";
        else if (diffDays === 1) relativeTime = "yesterday";
        else relativeTime = `${diffDays} days ago`;
      }

      const result = {
        isRepo: true,
        branch: defaultBranch,
        uncommittedCount: 0,
        lastCommitMsg: (lastCommit?.commit?.message || "").split("\n")[0],
        lastCommitTime: relativeTime || "unknown",
      };

      // Save to localStorage cache
      if (typeof window !== "undefined") {
        try {
          storedCache[cacheKey] = { data: result, timestamp: Date.now() };
          localStorage.setItem("github_git_stats_cache", JSON.stringify(storedCache));
        } catch {}
      }

      return result;
    } catch (err) {
      console.warn("GitHub API fetch failed (network error):", err);
      if (cachedEntry) return cachedEntry.data;
      return { isRepo: false };
    }
  }

  // Local development fallback
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    try {
      const res = await fetch(`/api/git?path=${encodeURIComponent(pathOrRepo)}`, { cache: "no-store" });
      if (res.ok) {
        return res.json();
      }
    } catch (err) {
      console.warn("Local API git route failed, falling back:", err);
    }
  }

  return { isRepo: false };
};

export const fetchNotes = async (id: string) => {
  try {
    const record = await db.notes.get(id);
    if (record) {
      return { content: record.content };
    }

    // Migration fallback: check if server notes exist
    console.log(`Note ${id} not found in IndexedDB, checking server migration...`);
    const res = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) {
      const serverData = await res.json();
      const content = serverData.content || "";
      await db.notes.put({ id, content, updatedAt: Date.now() });
      return { content };
    }
    return { content: "" };
  } catch (error) {
    console.error("fetchNotes local error:", error);
    return { content: "" };
  }
};

export const saveNotes = async (id: string, content: string) => {
  try {
    await db.notes.put({ id, content, updatedAt: Date.now() });
    return { success: true };
  } catch (error) {
    console.error("saveNotes local error:", error);
    throw error;
  }
};


