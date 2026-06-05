import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetPath = searchParams.get("path");

  if (!targetPath) {
    return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
  }

  // Check if directory exists first
  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ error: "Directory does not exist" }, { status: 404 });
  }

  // Security check: restrict paths to subdirectories of /home/aper/Documents
  const resolvedPath = fs.realpathSync(targetPath);
  if (!resolvedPath.startsWith("/home/aper/Documents")) {
    return NextResponse.json({ error: "Access denied: Path must be within /home/aper/Documents" }, { status: 403 });
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to query Git repository" }, { status: 500 });
  }
}
