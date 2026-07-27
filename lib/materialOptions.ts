/**
 * The vocabularies the materials UI offers, and that AI generation is
 * constrained to.
 *
 * These began as a graphics/CS curriculum — Mathematics, Computer Graphics,
 * Programming Languages, DSA — which was right when Horizon held one personal
 * track. It stopped being right once a track could be about anything: a
 * couch-to-5k plan filed every book under "Other".
 *
 * The originals are kept so existing materials keep their category rather than
 * silently collapsing, and broader ones are added alongside. `categoriesFor`
 * also surfaces any category already present in the user's data, so a value
 * typed before this list existed never disappears from the dropdown.
 */

export const MATERIAL_CATEGORIES = [
  // General-purpose, applicable to any goal.
  "Fundamentals",
  "Technique",
  "Practice",
  "Reference",
  "Health & Fitness",
  "Language",
  "Business",
  // Original CS/graphics set, retained so existing data keeps its grouping.
  "Mathematics",
  "Computer Graphics",
  "Programming Languages",
  "DSA",
  "Other",
] as const;

export const MATERIAL_TYPES = [
  "Book",
  "Website",
  "Course",
  "Video",
  "Podcast",
  "Paper",
  "Other",
] as const;

export const MATERIAL_STATUSES = ["Not Started", "In Progress", "Completed"] as const;

/**
 * The category list to show, including any value already in use that isn't in
 * the canonical list — otherwise editing such a material would silently
 * reassign it the moment the dropdown rendered.
 */
/**
 * A search URL for a material, built from its own title and author.
 *
 * This exists instead of generating a link. A model asked for a URL will
 * produce one that looks right and resolves to nothing — or worse, to something
 * unrelated — and a link is clickable, so the user finds out by going there.
 * Constructing the query ourselves is not a guess: it always resolves, it takes
 * you to the real thing when the title is real, and it visibly finds nothing
 * when the title was invented. That last property is a feature, not a
 * shortcoming — it is how a fabricated recommendation gets caught.
 */
export function searchUrlFor(material: { title: string; author?: string }): string {
  const query = [material.title, material.author].filter(Boolean).join(" ");
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

export function categoriesFor(existing: readonly { category?: string }[]): string[] {
  const known = new Set<string>(MATERIAL_CATEGORIES);
  const extra = existing
    .map((m) => m.category)
    .filter((c): c is string => !!c && !known.has(c))
    .filter((c, i, arr) => arr.indexOf(c) === i);
  return [...MATERIAL_CATEGORIES, ...extra];
}
