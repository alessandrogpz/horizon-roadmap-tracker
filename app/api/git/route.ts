import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { isLocalRequest, localOnlyResponse, resolveHomePath } from "@/lib/server/localRequest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return localOnlyResponse();
  }
  const { searchParams } = new URL(req.url);
  const targetPath = searchParams.get("path");

  if (!targetPath) {
    return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
  }

  // Restricted to ~/Documents. Exact prefix match on a path boundary — a bare
  // startsWith would also let sibling dirs like "~/Documents-private" through.
  const homeDocumentsDir = path.join(os.homedir(), "Documents");
  const inside = (p: string) => p === homeDocumentsDir || p.startsWith(homeDocumentsDir + path.sep);
  const denied = () => NextResponse.json({ error: "Access denied." }, { status: 403 });

  // Checked on the path as written *before* asking whether it exists, so the
  // answer never reveals whether some path outside ~/Documents exists (threat
  // I5). The message doesn't name the directory either (I4).
  const requestedPath = path.resolve(resolveHomePath(targetPath));
  if (!inside(requestedPath)) return denied();

  if (!fs.existsSync(requestedPath)) {
    return NextResponse.json({ error: "Directory does not exist" }, { status: 404 });
  }

  // And again after following symlinks: a link inside ~/Documents may point out.
  const resolvedPath = fs.realpathSync(requestedPath);
  if (!inside(resolvedPath)) return denied();

  try {
    // 1. Check if it's a git repo
    let isRepo = false;
    try {
      const isWorkTree = execSync("git rev-parse --is-inside-work-tree", { cwd: resolvedPath, stdio: "pipe" })
        .toString()
        .trim();
      isRepo = isWorkTree === "true";
    } catch {
      return NextResponse.json({ isRepo: false });
    }

    if (!isRepo) {
      return NextResponse.json({ isRepo: false });
    }

    // 2. Get active branch
    let branch = "unknown";
    try {
      branch = execSync("git branch --show-current", { cwd: resolvedPath, stdio: "pipe" })
        .toString()
        .trim();
    } catch {}

    // 3. Get uncommitted change count (modified, deleted, untracked)
    let uncommittedCount = 0;
    try {
      const statusOutput = execSync("git status --porcelain", { cwd: resolvedPath, stdio: "pipe" })
        .toString()
        .trim();
      if (statusOutput) {
        uncommittedCount = statusOutput.split("\n").length;
      }
    } catch {}

    // 4. Get last commit details
    let lastCommitMsg = "";
    let lastCommitTime = "";
    try {
      const lastCommitOutput = execSync('git log -1 --format="%s|%cr"', { cwd: resolvedPath, stdio: "pipe" })
        .toString()
        .trim();
      if (lastCommitOutput) {
        const parts = lastCommitOutput.split("|");
        lastCommitMsg = parts[0] || "";
        lastCommitTime = parts[1] || "";
      }
    } catch {}

    return NextResponse.json({
      isRepo: true,
      branch,
      uncommittedCount,
      lastCommitMsg,
      lastCommitTime,
    });
  } catch (error) {
    // Details stay in the server log; the client gets a generic message (I4).
    console.error("/api/git failed:", error);
    return NextResponse.json({ error: "Failed to query Git repository" }, { status: 500 });
  }
}
