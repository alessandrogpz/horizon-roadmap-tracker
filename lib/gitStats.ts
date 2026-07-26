// Repository status for materials and portfolio projects, from either the
// GitHub API (any device) or the local-only /api/git route (localhost only).
//
// The GitHub API allows 60 unauthenticated requests/hour per IP, so results
// are cached in localStorage for 15 minutes and an expired entry is still
// served if a request comes back rate-limited — the UI always shows
// something rather than blanking out.

import type { GitStats } from "./types";

const CACHE_KEY = "github_git_stats_cache";
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  data: GitStats;
  timestamp: number;
}

const readCache = (): Record<string, CacheEntry> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeCache = (key: string, data: GitStats): void => {
  if (typeof window === "undefined") return;
  try {
    const cache = readCache();
    cache[key] = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked — the stats are a nice-to-have, not worth failing over.
  }
};

/** Optional personal access token raises the GitHub API rate limit from
 *  60 requests/hour (per IP) to 5000/hour. Set it once from the browser
 *  console: localStorage.setItem("github_token", "<token>") */
const githubAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== "undefined" ? localStorage.getItem("github_token") || "" : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Pulls "owner/repo" out of a GitHub URL, an SSH remote, or a bare
 *  "owner/repo" string. Returns null for anything that looks like a
 *  filesystem path instead. */
const parseGitHubRepo = (pathOrRepo: string): { owner: string; repo: string } | null => {
  const urlMatch = pathOrRepo.match(/(?:github\.com\/|git@github\.com:)([^/]+)\/([^./]+)(?:\.git)?/);
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2].replace(".git", "") };

  const looksLikePath = pathOrRepo.startsWith("/") || pathOrRepo.startsWith("~");
  if (!looksLikePath && pathOrRepo.includes("/")) {
    const [owner, repo] = pathOrRepo.split("/");
    if (owner && repo) return { owner, repo: repo.replace(".git", "") };
  }
  return null;
};

const relativeCommitTime = (isoDate: string | undefined): string => {
  if (!isoDate) return "";
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
};

const fetchGitHubStats = async (owner: string, repo: string): Promise<GitStats> => {
  const cacheKey = `${owner}/${repo}`;
  const cached = readCache()[cacheKey];
  if (cached && Date.now() - cached.timestamp <= CACHE_TTL_MS) return cached.data;

  const headers = githubAuthHeaders();

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (repoRes.status === 403) {
      console.warn(`GitHub API rate limited for ${cacheKey}. Stats unavailable until the limit resets.`);
      // Fall back to the expired cache if there is one, so the UI doesn't blank out.
      return cached ? cached.data : { isRepo: false, rateLimited: true };
    }
    if (repoRes.status === 404) return { isRepo: false };
    if (!repoRes.ok) {
      console.warn(`GitHub API returned ${repoRes.status} for ${cacheKey}`);
      return cached ? cached.data : { isRepo: false };
    }

    const repoData = await repoRes.json();
    const branch = repoData.default_branch || "main";

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers });
    if (!commitRes.ok) {
      const result: GitStats = { isRepo: true, branch, uncommittedCount: 0, lastCommitMsg: "", lastCommitTime: "" };
      writeCache(cacheKey, result);
      return result;
    }

    const lastCommit = (await commitRes.json())[0];
    const result: GitStats = {
      isRepo: true,
      branch,
      uncommittedCount: 0,
      lastCommitMsg: (lastCommit?.commit?.message || "").split("\n")[0],
      lastCommitTime: relativeCommitTime(lastCommit?.commit?.author?.date) || "unknown",
    };
    writeCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn("GitHub API fetch failed (network error):", err);
    return cached ? cached.data : { isRepo: false };
  }
};

const isLocalhost = () =>
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const fetchLocalRepoStats = async (path: string): Promise<GitStats> => {
  try {
    const res = await fetch(`/api/git?path=${encodeURIComponent(path)}`, { cache: "no-store" });
    if (res.ok) return res.json();
  } catch (err) {
    console.warn("Local API git route failed, falling back:", err);
  }
  return { isRepo: false };
};

export const fetchGitStats = async (pathOrRepo: string): Promise<GitStats> => {
  const github = parseGitHubRepo(pathOrRepo);
  if (github) return fetchGitHubStats(github.owner, github.repo);
  if (isLocalhost()) return fetchLocalRepoStats(pathOrRepo);
  return { isRepo: false };
};

/** True when a material/project has something worth querying git stats for. */
export const hasGitSource = (source: string): boolean =>
  source.includes("github.com") || source.startsWith("/") || source.startsWith("~");
