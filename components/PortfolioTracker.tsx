"use client";

import React, { useEffect, useState } from "react";
import { fetchGitStats } from "@/lib/api";

interface Project {
  id: string;
  title: string;
  completed: boolean;
  localPath?: string;
  repoUrl?: string;
}

interface PortfolioTrackerProps {
  portfolio: Project[];
  onToggle: (id: string) => void;
}

export default function PortfolioTracker({ portfolio, onToggle }: PortfolioTrackerProps) {
  const [gitStats, setGitStats] = useState<{ [id: string]: any }>({});

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
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 className="section-title">Portfolio Deliverables</h2>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "0.5rem" }}>
        {portfolio.map((proj, idx) => (
          <div 
            key={proj.id} 
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.75rem 0",
              borderBottom: idx === portfolio.length - 1 ? "none" : "1px solid var(--card-border)"
            }}
          >
            <input 
              type="checkbox" 
              className="checkbox-custom"
              checked={proj.completed} 
              onChange={() => onToggle(proj.id)}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ 
                fontSize: "0.95rem", 
                fontWeight: 500,
                color: proj.completed ? "#71717a" : "var(--foreground)",
                textDecoration: proj.completed ? "line-through" : "none",
                transition: "color 0.2s ease"
              }}>
                {proj.title}
              </span>
              {gitStats[proj.id] && gitStats[proj.id].isRepo && (
                <div style={{ fontSize: "0.7rem", color: "#a1a1aa", marginTop: "0.2rem", fontFamily: "monospace", display: "flex", flexWrap: "wrap", columnGap: "0.5rem" }}>
                  <span>branch: <span style={{ color: "var(--accent)" }}>{gitStats[proj.id].branch}</span></span>
                  <span>|</span>
                  {gitStats[proj.id].uncommittedCount > 0 ? (
                    <span style={{ color: "var(--warning)" }}>{gitStats[proj.id].uncommittedCount} modified</span>
                  ) : (
                    <span style={{ color: "var(--success)" }}>clean</span>
                  )}
                  {gitStats[proj.id].lastCommitMsg && (
                    <>
                      <span>|</span>
                      <span style={{ color: "#71717a" }} title={gitStats[proj.id].lastCommitMsg}>
                        last: {gitStats[proj.id].lastCommitMsg.length > 20 ? `${gitStats[proj.id].lastCommitMsg.slice(0, 20)}...` : gitStats[proj.id].lastCommitMsg} ({gitStats[proj.id].lastCommitTime})
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
