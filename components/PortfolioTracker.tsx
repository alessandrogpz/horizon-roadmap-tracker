"use client";

import React, { useEffect, useState } from "react";
import { fetchGitStats } from "@/lib/api";
import type { GitStats, PortfolioProject } from "@/lib/types";

interface PortfolioTrackerProps {
  portfolio: PortfolioProject[];
  onToggle: (id: string) => void;
}

export default function PortfolioTracker({ portfolio, onToggle }: PortfolioTrackerProps) {
  const [gitStats, setGitStats] = useState<{ [id: string]: GitStats }>({});

  useEffect(() => {
    portfolio.forEach(proj => {
      // repoUrl is injected by migrateLocalPaths from the authoritative ID map — always reliable
      const source = proj.repoUrl || proj.localPath || "";
      if (source.includes("github.com") || source.startsWith("/") || source.startsWith("~")) {
        fetchGitStats(source)
          .then(stats => {
            setGitStats(prev => ({ ...prev, [proj.id]: stats }));
          })
          .catch(err => console.error(`Error fetching git stats for ${proj.title}:`, err));
      }
    });
  }, [portfolio]);

  return (
    <div className="glass-panel flex flex-col gap-4">
      <h2 className="section-title">Portfolio Deliverables</h2>
      <div className="flex flex-col mt-2">
        {portfolio.map((proj, idx) => (
          <div
            key={proj.id}
            className={`flex items-center gap-4 py-3 ${idx === portfolio.length - 1 ? "" : "border-b border-card-border"}`}
          >
            <input
              type="checkbox"
              className="checkbox-custom"
              checked={proj.completed}
              onChange={() => onToggle(proj.id)}
            />
            <div className="flex-1 flex flex-col">
              <span className={`text-[0.95rem] font-medium transition-colors duration-200 ${proj.completed ? "text-zinc-500 line-through" : "text-foreground"}`}>
                {proj.title}
              </span>
              {gitStats[proj.id] && gitStats[proj.id].isRepo && (
                <div className="text-[0.7rem] text-zinc-400 mt-1 font-mono flex flex-wrap gap-x-2">
                  <span>branch: <span className="text-accent">{gitStats[proj.id].branch}</span></span>
                  <span>|</span>
                  {(gitStats[proj.id].uncommittedCount ?? 0) > 0 ? (
                    <span className="text-warning">{gitStats[proj.id].uncommittedCount} modified</span>
                  ) : (
                    <span className="text-success">clean</span>
                  )}
                  {gitStats[proj.id].lastCommitMsg && (
                    <>
                      <span>|</span>
                      <span className="text-zinc-500" title={gitStats[proj.id].lastCommitMsg}>
                        last: {(gitStats[proj.id].lastCommitMsg || "").length > 20 ? `${gitStats[proj.id].lastCommitMsg!.slice(0, 20)}...` : gitStats[proj.id].lastCommitMsg} ({gitStats[proj.id].lastCommitTime})
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
