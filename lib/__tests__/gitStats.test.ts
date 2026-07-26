import { describe, it, expect } from "vitest";
import { hasGitSource, parseGitSources, serializeGitSources } from "../gitStats";

describe("hasGitSource", () => {
  it("accepts GitHub URLs and filesystem paths", () => {
    expect(hasGitSource("https://github.com/owner/repo")).toBe(true);
    expect(hasGitSource("/home/aper/code/ray-tracer")).toBe(true);
    expect(hasGitSource("~/code/ray-tracer")).toBe(true);
  });

  it("rejects anything with no repo behind it", () => {
    expect(hasGitSource("")).toBe(false);
    expect(hasGitSource("Programming: Principles and Practice")).toBe(false);
    expect(hasGitSource("https://learnopengl.com")).toBe(false);
  });
});

describe("serializeGitSources", () => {
  it("round-trips through parseGitSources", () => {
    const sources = [
      { id: "m1", source: "https://github.com/owner/ray-tracer" },
      { id: "m2", source: "/home/aper/code/engine" },
    ];
    expect(parseGitSources(serializeGitSources(sources))).toEqual(sources);
  });

  it("drops entries with no repo, so they never trigger a fetch", () => {
    const key = serializeGitSources([
      { id: "m1", source: "https://github.com/owner/repo" },
      { id: "m2", source: "" },
      { id: "m3", source: "A book with no repo" },
    ]);
    expect(parseGitSources(key).map((s) => s.id)).toEqual(["m1"]);
  });

  it("is stable when nothing about the repos changed", () => {
    // The same list rebuilt from a fresh workspace object — a new array
    // identity every time, which is exactly what used to re-trigger fetching.
    const build = () => [{ id: "m1", source: "https://github.com/owner/repo" }];
    expect(serializeGitSources(build())).toBe(serializeGitSources(build()));
  });

  it("changes when a repo is added, removed, or re-pointed", () => {
    const one = serializeGitSources([{ id: "m1", source: "https://github.com/owner/a" }]);
    const repointed = serializeGitSources([{ id: "m1", source: "https://github.com/owner/b" }]);
    const added = serializeGitSources([
      { id: "m1", source: "https://github.com/owner/a" },
      { id: "m2", source: "https://github.com/owner/b" },
    ]);
    expect(repointed).not.toBe(one);
    expect(added).not.toBe(one);
    expect(serializeGitSources([])).toBe("");
  });

  it("ignores reordering of unrelated fields but not of the repos themselves", () => {
    // Order is part of the key: two tracks listing the same repos in a
    // different order are different lists, and re-fetching is cheap because
    // the per-repo cache still hits.
    const a = serializeGitSources([
      { id: "m1", source: "https://github.com/owner/a" },
      { id: "m2", source: "https://github.com/owner/b" },
    ]);
    const b = serializeGitSources([
      { id: "m2", source: "https://github.com/owner/b" },
      { id: "m1", source: "https://github.com/owner/a" },
    ]);
    expect(a).not.toBe(b);
  });
});

describe("parseGitSources", () => {
  it("returns nothing for an empty key", () => {
    expect(parseGitSources("")).toEqual([]);
  });

  it("survives ids and URLs containing the usual punctuation", () => {
    const sources = [{ id: "m-1_2:3", source: "https://github.com/owner/repo.js" }];
    expect(parseGitSources(serializeGitSources(sources))).toEqual(sources);
  });
});
