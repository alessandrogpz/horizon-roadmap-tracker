// The localhost-only routes' own input checks (threats I4, I5, E4). The
// localhost guard itself has its tests in localRequest.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("child_process", async (original) => ({
  ...(await original<typeof import("child_process")>()),
  spawn: vi.fn(() => ({ unref: () => {} })),
}));

const { GET: gitGet } = await import("@/app/api/git/route");
const { POST: openPost } = await import("@/app/api/open/route");
const { spawn } = await import("child_process");

const local = { host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" };

afterEach(() => vi.mocked(spawn).mockClear());

describe("/api/git", () => {
  const ask = (target: string) =>
    gitGet(new NextRequest(`http://localhost:3000/api/git?path=${encodeURIComponent(target)}`, { headers: local }));

  it("gives the same answer outside ~/Documents whether the path exists or not (I5)", async () => {
    const exists = await ask(os.homedir()); // exists, outside
    const missing = await ask(path.join(os.homedir(), "no-such-dir-horizon-test")); // doesn't exist, outside
    expect(exists.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(await exists.json()).toEqual(await missing.json());
  });

  it("doesn't name the home directory in its refusal (I4)", async () => {
    const body = await (await ask("/etc")).json();
    expect(JSON.stringify(body)).not.toContain(os.homedir());
  });

  it("sees through ../ tricks", async () => {
    expect((await ask("~/Documents/../.ssh")).status).toBe(403);
  });
});

describe("/api/open", () => {
  const open = (body: unknown) =>
    openPost(
      new Request("http://localhost:3000/api/open", {
        method: "POST",
        headers: { ...local, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );

  it("refuses a link xdg-open would read as an option (E4)", async () => {
    expect((await open({ link: "--help" })).status).toBe(400);
    expect((await open({ link: "  -x" })).status).toBe(400);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("refuses anything but a string of sane length", async () => {
    expect((await open({ link: { $ne: null } })).status).toBe(400);
    expect((await open({ link: ["a"] })).status).toBe(400);
    expect((await open({ link: "x".repeat(5000) })).status).toBe(400);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("still opens an ordinary link", async () => {
    expect((await open({ link: "https://example.com/book.pdf" })).status).toBe(200);
    expect(spawn).toHaveBeenCalledWith("xdg-open", ["https://example.com/book.pdf"], expect.anything());
  });
});
