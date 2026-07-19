import { db } from "./localDb";

export const fetchAppState = async () => {
  try {
    // 1. Try to load from IndexedDB
    const record = await db.appState.get("current");
    if (record) {
      return record.data;
    }

    // 2. If empty, perform one-time migration from Next.js database.json
    console.log("IndexedDB is empty, migrating from server database.json...");
    const res = await fetch("/api/data", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch initial migration data");
    const serverData = await res.json();

    // 3. Save to IndexedDB
    await db.appState.put({ id: "current", data: serverData });
    return serverData;
  } catch (error) {
    console.error("fetchAppState local error:", error);
    throw error;
  }
};

export const updateAppState = async (newState: any) => {
  try {
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

