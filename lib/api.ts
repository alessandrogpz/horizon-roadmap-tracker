import { db } from "./localDb";

const DEFAULT_SKETCH_STATE = {
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
  completedItemsHistory: [],
  weeklyCompletions: {},
  studyStreak: []
};

export const fetchAppState = async () => {
  try {
    // 1. Try to load from IndexedDB
    const record = await db.appState.get("current");
    if (record) {
      return record.data;
    }

    // 2. If empty, save the default mock sketch template to IndexedDB
    console.log("IndexedDB is empty, initializing default sketch template...");
    await db.appState.put({ id: "current", data: DEFAULT_SKETCH_STATE });
    return DEFAULT_SKETCH_STATE;
  } catch (error) {
    console.error("fetchAppState local error:", error);
    throw error;
  }
};

export const updateAppState = async (newState: any) => {
  try {
    const record = await db.appState.get("current");
    const oldData = record?.data || {};
    
    const lastUpdatedDates = { ...(newState.lastUpdatedDates || {}) };
    
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

    if (newState.hasUnsyncedChanges === undefined) {
      if (hasChanges) {
        newState.hasUnsyncedChanges = true;
      } else {
        newState.hasUnsyncedChanges = oldData.hasUnsyncedChanges ?? false;
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

export const fetchGitStats = async (pathOrRepo: string) => {
  // If it's a GitHub repo identifier (e.g. "owner/repo" or a github URL)
  const githubRegex = /(?:github\.com\/|git@github\.com:)([^\/]+)\/([^.]+)(?:\.git)?/;
  const match = pathOrRepo.match(githubRegex) || (!pathOrRepo.startsWith("/") && !pathOrRepo.startsWith("~") && pathOrRepo.includes("/") ? [pathOrRepo, ...pathOrRepo.split("/")] : null);

  if (match) {
    const owner = match[1];
    const repo = match[2]?.replace(".git", "");
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoRes.ok) throw new Error("Failed to fetch repo info");
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || "main";

      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`);
      if (!commitRes.ok) throw new Error("Failed to fetch commit info");
      const commits = await commitRes.json();
      const lastCommit = commits[0];

      // Format timestamp relatively or cleanly
      let relativeTime = "";
      if (lastCommit?.commit?.author?.date) {
        const commitDate = new Date(lastCommit.commit.author.date);
        const diffMs = Date.now() - commitDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) relativeTime = "today";
        else if (diffDays === 1) relativeTime = "yesterday";
        else relativeTime = `${diffDays} days ago`;
      }

      return {
        isRepo: true,
        branch: defaultBranch,
        uncommittedCount: 0, // Not available client-side
        lastCommitMsg: lastCommit?.commit?.message || "",
        lastCommitTime: relativeTime || "unknown",
      };
    } catch (err) {
      console.error("GitHub API fetch failed:", err);
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

export const syncWorkspace = async (): Promise<{ success: boolean; log: string[]; error?: string }> => {
  // Will implement Google Drive synchronization in Phase 3
  return { success: true, log: ["Dexie local-first mode active"] };
};

export const fetchReflection = async (week: number) => {
  return { content: "" };
};

export const saveReflection = async (week: number, date: string, content: string, day: string = "Weekly") => {
  return { success: true };
};

