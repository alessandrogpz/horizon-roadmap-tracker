// Repository status for materials and portfolio projects, from either the
// GitHub API (any device) or the local-only /api/git route (localhost only).
//
// The GitHub API allows 60 unauthenticated requests/hour per IP and a repo
// costs two of them (metadata + last commit), so four linked repos burn eight
// requests a pass. Three things keep that inside the budget:
//
//   1. Results are cached in localStorage for an hour — a last-commit message
//      does not change often enough to justify re-checking every few minutes.
//   2. A 403 parks every repo until GitHub's own reset time, so being rate
//      limited costs zero further requests instead of retrying on each render.
//   3. Concurrent requests for the same repo share one promise — the Materials
//      and Portfolio panels routinely want the same repo at the same moment.
//
// An expired entry is still served whenever a request can't be made, so the UI
// shows something rather than blanking out.

import type { GitStats } from "./types";

const CACHE_KEY = "github_git_stats_cache";
const RATE_LIMIT_KEY = "github_rate_limited_until";
const CACHE_TTL_MS = 60 * 60 * 1000;
/** Used when a 403 arrives without GitHub's own reset header. */
const FALLBACK_BACKOFF_MS = 15 * 60 * 1000;

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

// --- Rate-limit gate ---------------------------------------------------

/** Persisted, not just in memory: a reload during the lockout would otherwise
 *  fire a fresh round of doomed requests. */
const readRateLimitedUntil = (): number => {
  if (typeof window === "undefined") return 0;
  const stored = Number(localStorage.getItem(RATE_LIMIT_KEY));
  return Number.isFinite(stored) ? stored : 0;
};

const setRateLimitedUntil = (until: number): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RATE_LIMIT_KEY, String(until));
  } catch {
    // Nothing to persist to; the in-flight map still dedupes this session.
  }
  const minutes = Math.max(1, Math.round((until - Date.now()) / 60000));
  console.warn(
    `GitHub API rate limit reached. Showing cached repo stats and pausing requests for ~${minutes} min. ` +
      `Set a token to raise the limit to 5000/hour: localStorage.setItem("github_token", "<token>")`
  );
};

/** GitHub reports exactly when the window resets — honour it rather than
 *  guessing, so the app neither hammers nor waits longer than it must. */
const resetTimeFrom = (res: Response): number => {
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  return Number.isFinite(reset) && reset > 0 ? reset * 1000 : Date.now() + FALLBACK_BACKOFF_MS;
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

const requestGitHubStats = async (owner: string, repo: string): Promise<GitStats> => {
  const cacheKey = `${owner}/${repo}`;
  const cached = readCache()[cacheKey];
  if (cached && Date.now() - cached.timestamp <= CACHE_TTL_MS) return cached.data;

  // Still inside a known lockout: don't spend a request to be told no again.
  if (Date.now() < readRateLimitedUntil()) {
    return cached ? cached.data : { isRepo: false, rateLimited: true };
  }

  const headers = githubAuthHeaders();

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (repoRes.status === 403) {
      setRateLimitedUntil(resetTimeFrom(repoRes));
      // Fall back to the expired cache if there is one, so the UI doesn't blank out.
      return cached ? cached.data : { isRepo: false, rateLimited: true };
    }
    if (repoRes.status === 404) {
      // Cached like any other answer — a typo'd URL shouldn't re-ask forever.
      const result: GitStats = { isRepo: false };
      writeCache(cacheKey, result);
      return result;
    }
    if (!repoRes.ok) {
      console.warn(`GitHub API returned ${repoRes.status} for ${cacheKey}`);
      return cached ? cached.data : { isRepo: false };
    }

    const repoData = await repoRes.json();
    const branch = repoData.default_branch || "main";

    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers });
    if (commitRes.status === 403) {
      setRateLimitedUntil(resetTimeFrom(commitRes));
      return cached ? cached.data : { isRepo: true, branch, uncommittedCount: 0, lastCommitMsg: "", lastCommitTime: "" };
    }
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

/** One request per repo at a time. Materials and Portfolio can both link the
 *  same repository, and both panels mount together — without this they each
 *  open their own round trip for identical data. */
const inFlight = new Map<string, Promise<GitStats>>();

const fetchGitHubStats = (owner: string, repo: string): Promise<GitStats> => {
  const cacheKey = `${owner}/${repo}`;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = requestGitHubStats(owner, repo).finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, request);
  return request;
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

// --- Effect keying -----------------------------------------------------

export interface GitSource {
  /** The material or portfolio project the stats belong to. */
  id: string;
  /** Its repo URL or local path. */
  source: string;
}

// ASCII unit/record separators — neither can occur in an id or a repo path.
const FIELD_SEP = "\u001f";
const RECORD_SEP = "\u001e";

/**
 * Serializes the id→source pairs that actually drive fetching, dropping
 * anything with no repo behind it.
 *
 * Panels key their fetch effect on this string rather than on the `materials`
 * or `portfolio` array. Those arrays get a new identity on every unrelated
 * workspace edit — a ticked checkbox, a sync, the daily reset — which made the
 * effect re-run, and re-fetch, constantly. The string only changes when a repo
 * is actually added, removed, or re-pointed.
 */
export const serializeGitSources = (items: GitSource[]): string =>
  items
    .filter((item) => hasGitSource(item.source))
    .map((item) => `${item.id}${FIELD_SEP}${item.source}`)
    .join(RECORD_SEP);

/** Inverse of `serializeGitSources`, so the effect can work from its own
 *  dependency instead of closing over a stale array. */
export const parseGitSources = (key: string): GitSource[] =>
  key
    ? key.split(RECORD_SEP).map((record) => {
        const [id, source] = record.split(FIELD_SEP);
        return { id, source };
      })
    : [];
