import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cwd = process.cwd();

  // 1. Verify it's a git repo
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd, stdio: "pipe" });
  } catch {
    return NextResponse.json({ error: "Tracker workspace is not a Git repository. Sync skipped." }, { status: 400 });
  }

  try {
    const logEvents: string[] = [];

    // 2. Fetch and Rebase
    try {
      execSync("git pull --rebase", { cwd, stdio: "pipe" });
      logEvents.push("Pulled latest updates from remote.");
    } catch (err: any) {
      logEvents.push(`Pull warning/error: ${err.message || err.toString()}`);
    }

    // 3. Stage changes
    let hasChanges = false;
    try {
      // Stage database.json, history.log and markdown notes
      execSync("git add data/database.json data/history.log data/notes/", { cwd, stdio: "pipe" });
      
      // Check status to see if anything is staged
      const stagedOutput = execSync("git status --porcelain", { cwd, stdio: "pipe" })
        .toString()
        .trim();
      
      // Look for lines starting with staged modification characters (M, A, D, R)
      if (stagedOutput) {
        hasChanges = stagedOutput.split("\n").some(line => {
          const status = line.slice(0, 2);
          return status.includes("M") || status.includes("A") || status.includes("D") || status.includes("R");
        });
      }
    } catch {}

    // 4. Commit if changes exist
    if (hasChanges) {
      try {
        execSync('git commit -m "sync: automatic progress updates"', { cwd, stdio: "pipe" });
        logEvents.push("Committed local changes.");
      } catch (err: any) {
        logEvents.push(`Commit error: ${err.message}`);
      }
    } else {
      logEvents.push("No local changes to commit.");
    }

    // 5. Push changes
    let pushed = false;
    try {
      // Check if remote is configured first
      const remoteConfigured = execSync("git remote", { cwd, stdio: "pipe" })
        .toString()
        .trim();
      
      if (remoteConfigured) {
        execSync("git push", { cwd, stdio: "pipe" });
        logEvents.push("Pushed local changes to remote.");
        pushed = true;
      } else {
        logEvents.push("No Git remote configured, skipped pushing.");
      }
    } catch (err: any) {
      return NextResponse.json({ 
        success: false, 
        error: `Push failed: ${err.message || err.toString()}`,
        log: logEvents 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pushed,
      log: logEvents
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Git synchronization failed" }, { status: 500 });
  }
}
