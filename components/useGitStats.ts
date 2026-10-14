"use client";

import { useEffect, useState } from "react";
import { fetchGitStats, parseGitSources, serializeGitSources, type GitSource } from "@/lib/gitStats";
import type { GitStats } from "@/lib/types";

/**
 * Git status for a list of local repos, fetched once per distinct list.
 *
 * The subtlety worth keeping in one place is the key. Keying the effect on the
 * array itself re-runs it on every unrelated workspace edit — its identity
 * changes when anything in the workspace does — which meant ticking a checkbox
 * re-fetched every repo and burned the GitHub API's sixty-an-hour budget. The
 * key is the serialised source list, so the fetch happens when the repos
 * change and not when something else does.
 *
 * In flight when the list changes, the result is dropped rather than written
 * to state for a component that has moved on.
 *
 * Both lists that carry repos — materials and portfolio projects — had their
 * own copy of this, identical down to the error message.
 */
export function useGitStats(sources: GitSource[]): Record<string, GitStats> {
  const [stats, setStats] = useState<Record<string, GitStats>>({});
  const key = serializeGitSources(sources);

  useEffect(() => {
    let cancelled = false;
    parseGitSources(key).forEach(({ id, source }) => {
      fetchGitStats(source)
        .then((next) => {
          if (!cancelled) setStats((previous) => ({ ...previous, [id]: next }));
        })
        .catch((error) => console.error(`Error fetching git stats for ${source}:`, error));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return stats;
}
