import { db } from "./localDb";
import type { AppState, GitStats, Material, PortfolioProject } from "./types";
import { LEGACY_PATH_TO_REPO, MATERIAL_REPO_MAP, PORTFOLIO_REPO_MAP } from "./migrationConfig";

const DEFAULT_SKETCH_STATE: AppState = {
  currentPhase: 1,
  startDate: "2026-07-01",
  dsaStartWeek: 1,
  streakHistory: [],
  lastDailyRoutineCheck: "",
  lastTasksResetDate: "",
  dailyFocus: {
    math: "",
    leetcode: "",
    revision: ""
  },
  dailyTasks: {
    Mon: [{ id: "mon_1", title: "Placeholder Study Task", completed: false }],
    Tue: [{ id: "tue_1", title: "Placeholder Study Task", completed: false }],
    Wed: [{ id: "wed_1", title: "Placeholder Study Task", completed: false }],
    Thu: [{ id: "thu_1", title: "Placeholder Study Task", completed: false }],
    Fri: [{ id: "fri_1", title: "Placeholder Study Task", completed: false }],
    Sat: [{ id: "sat_1", title: "Placeholder Study Task", completed: false }],
    Sun: []
  },
  dailyRevisionItems: {
    Mon: [{ id: "dsa_auto", title: "Placeholder DSA Pattern", description: "Placeholder problems", completed: false }],
    Tue: [{ id: "math_revision", title: "Placeholder Math Review", description: "Placeholder details", completed: false }],
    Wed: [{ id: "dsa_auto", title: "Placeholder DSA Pattern", description: "Placeholder problems", completed: false }],
    Thu: [{ id: "math_revision", title: "Placeholder Math Review", description: "Placeholder details", completed: false }],
    Fri: [{ id: "dsa_auto", title: "Placeholder DSA Pattern", description: "Placeholder problems", completed: false }],
    Sat: [{ id: "math_revision", title: "Placeholder Math Review", description: "Placeholder details", completed: false }],
    Sun: []
  },
  phases: [
    {
      id: 1,
      title: "Phase 01 (Placeholder)",
      description: "Connect Google Drive to load your personalized curriculum details.",
      tasks: [
        { id: "p1_t1", title: "Task Placeholder 1", completed: false },
        { id: "p1_t2", title: "Task Placeholder 2", completed: false }
      ],
      detailedInfo: {
        focus: "Placeholder Focus",
        deliverable: "Placeholder Deliverable",
        math: "Placeholder Math",
        algoDS: "Placeholder DSA"
      }
    },
    {
      id: 2,
      title: "Phase 02 (Placeholder)",
      description: "Connect Google Drive to load your personalized curriculum details.",
      tasks: [],
      detailedInfo: {
        focus: "Placeholder Focus",
        deliverable: "Placeholder Deliverable",
        math: "Placeholder Math",
        algoDS: "Placeholder DSA"
      }
    },
    {
      id: 3,
      title: "Phase 03 (Placeholder)",
      description: "Connect Google Drive to load your personalized curriculum details.",
      tasks: [],
      detailedInfo: {
        focus: "Placeholder Focus",
        deliverable: "Placeholder Deliverable",
        math: "Placeholder Math",
        algoDS: "Placeholder DSA"
      }
    },
    {
      id: 4,
      title: "Phase 04 (Placeholder)",
      description: "Connect Google Drive to load your personalized curriculum details.",
      tasks: [],
      detailedInfo: {
        focus: "Placeholder Focus",
        deliverable: "Placeholder Deliverable",
        math: "Placeholder Math",
        algoDS: "Placeholder DSA"
      }
    }
  ],
  portfolio: [
    { id: "port_1", title: "Sample Portfolio Project", completed: false, localPath: "owner/repo" }
  ],
  materials: [
    { id: "m1", title: "Sample Reference Material / Book", category: "Math", type: "Book", status: "Not Started", currentPage: 0, totalPages: 100, currentSubject: "Sample Subject", link: "https://example.com", localPath: "" }
  ],
  dailyStudyPoints: {},
  completedItemsHistory: {},
  weeklyCompletions: {},
  studyStreak: []
};

const migrateLocalPaths = (state: AppState) => {
  if (!state) return { state, modified: false };
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

  if (state.portfolio) {
    state.portfolio = state.portfolio.map((proj: PortfolioProject) => migrateEntry(proj, PORTFOLIO_REPO_MAP));
  }

  if (state.materials) {
    state.materials = state.materials.map((mat: Material) => migrateEntry(mat, MATERIAL_REPO_MAP));
  }

  return { state, modified };
};

export const fetchAppState = async (): Promise<AppState> => {
  try {
    // 1. Try to load from IndexedDB
    const record = await db.appState.get("current");
    if (record) {
      const { state, modified } = migrateLocalPaths(record.data);
      if (modified) {
        await db.appState.put({ id: "current", data: state });
      }
      return state;
    }

    // 2. If empty, save the default mock sketch template to IndexedDB
    console.log("IndexedDB is empty, initializing default sketch template...");
    const { state: migratedDefault } = migrateLocalPaths({ ...DEFAULT_SKETCH_STATE });
    await db.appState.put({ id: "current", data: migratedDefault });
    return migratedDefault;
  } catch (error) {
    console.error("fetchAppState local error:", error);
    throw error;
  }
};

export const updateAppState = async (newState: AppState) => {
  try {
    const record = await db.appState.get("current");
    const oldData: Partial<AppState> = record?.data || {};
    
    const lastUpdatedDates: Record<string, number> = { ...(newState.lastUpdatedDates || {}) };
    
    // Compare weeklyCompletions to see if any date changed
    const oldComps = oldData.weeklyCompletions || {};
    const newComps = newState.weeklyCompletions || {};
    const allDates = Array.from(new Set([
      ...Object.keys(oldComps),
      ...Object.keys(newComps)
    ]));
    
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
    
    // Compare completedItemsHistory
    const oldHist = oldData.completedItemsHistory || {};
    const newHist = newState.completedItemsHistory || {};
    const allHistDates = Array.from(new Set([
      ...Object.keys(oldHist),
      ...Object.keys(newHist)
    ]));
    
    allHistDates.forEach((date) => {
      const oldItems = oldHist[date] || [];
      const newItems = newHist[date] || [];
      
      if (JSON.stringify(oldItems) !== JSON.stringify(newItems)) {
        lastUpdatedDates[date] = (oldData.lastUpdatedDates?.[date] || 0) + 1;
        hasChanges = true;
      }
    });
    
    newState.lastUpdatedDates = lastUpdatedDates;

    // If this is a system-initiated daily reset, do NOT change configVersion
    // so we don't accidentally win version conflicts against other devices
    const isReset = !!newState.isReset;
    if (isReset) {
      delete newState.isReset;
      newState.configVersion = oldData.configVersion || 0;
      if (newState.hasUnsyncedChanges === undefined) {
        newState.hasUnsyncedChanges = oldData.hasUnsyncedChanges ?? false;
      }
    } else {
      // Targeted comparison of user-editable config fields only
      // Use sorted JSON so array order differences don't create false positives
      const sortedJSON = (v: unknown) => JSON.stringify(v, Object.keys(v || {}).sort());
      const CONFIG_COMPARE_FIELDS = [
        "materials",
        "portfolio",
        "currentPhase",
        "startDate",
        "currentPhaseStartDate",
        "dsaStartWeek",
        "weekSchedule",
      ] as const;

      let configChanged = false;
      for (const field of CONFIG_COMPARE_FIELDS) {
        const oldVal = oldData[field];
        const newVal = newState[field];
        if (sortedJSON(oldVal) !== sortedJSON(newVal)) {
          configChanged = true;
          break;
        }
      }

      if (configChanged || hasChanges) {
        newState.hasUnsyncedChanges = true;
      } else if (newState.hasUnsyncedChanges === undefined) {
        newState.hasUnsyncedChanges = oldData.hasUnsyncedChanges ?? false;
      }

      if (configChanged) {
        newState.configVersion = (oldData.configVersion || 0) + 1;
      } else {
        newState.configVersion = oldData.configVersion || 0;
      }
    }

    await db.appState.put({ id: "current", data: newState });
    return { success: true };
  } catch (error) {
    console.error("updateAppState local error:", error);
    throw error;
  }
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


