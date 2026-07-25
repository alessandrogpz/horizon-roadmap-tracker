import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { isLocalRequest, localOnlyResponse } from "@/lib/server/localRequest";

export const dynamic = "force-dynamic";

// Resolve paths beginning with ~ to the system user's home directory
function resolveHomePath(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

export async function GET(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return localOnlyResponse();
  }
  const { searchParams } = new URL(req.url);
  const targetPath = searchParams.get("path");

  if (!targetPath) {
    return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
  }

  const expandedPath = resolveHomePath(targetPath);

  // Check if directory exists first
  if (!fs.existsSync(expandedPath)) {
    return NextResponse.json({ error: "Directory does not exist" }, { status: 404 });
  }

  // Security check: restrict paths to subdirectories of ~/Documents
  const homeDocumentsDir = path.join(os.homedir(), "Documents");
  const resolvedPath = fs.realpathSync(expandedPath);
  // Exact prefix match on a path boundary — a bare startsWith would also let
  // sibling dirs like "~/Documents-private" through.
  if (resolvedPath !== homeDocumentsDir && !resolvedPath.startsWith(homeDocumentsDir + path.sep)) {
    return NextResponse.json({ error: `Access denied: Path must be within ${homeDocumentsDir}` }, { status: 403 });
  }

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
    const message = error instanceof Error ? error.message : "Failed to query Git repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
