// Personal migration mappings, kept out of the app logic.
// These upgrade records created by older versions of the app (which stored
// local filesystem paths) to GitHub repo URLs so git stats work everywhere.

/** Old local path → GitHub URL (backward compat). */
export const LEGACY_PATH_TO_REPO: Record<string, string> = {
  "~/Documents/ray-tracer": "https://github.com/alessandrogpz/ray-tracer",
  "~/Documents/LinearAlgebra": "https://github.com/alessandrogpz/linear-algebra",
  "~/Documents/PPPC++": "https://github.com/alessandrogpz/CCCP-3rd",
  "~/Documents/LearnOpenGL": "https://github.com/alessandrogpz/learn-opengl",
};

/**
 * Authoritative material ID → GitHub repo URL mapping.
 * Ensures git stats always show regardless of what localPath has in IndexedDB.
 */
export const MATERIAL_REPO_MAP: Record<string, string> = {
  m1: "https://github.com/alessandrogpz/linear-algebra",
  m2: "https://github.com/alessandrogpz/CCCP-3rd",
  m4: "https://github.com/alessandrogpz/ray-tracer",
  m5: "https://github.com/alessandrogpz/learn-opengl",
};

export const PORTFOLIO_REPO_MAP: Record<string, string> = {
  p1: "https://github.com/alessandrogpz/ray-tracer",
};
