"use client";

import React, { useEffect, useState } from "react";
import { FolderGit2, X } from "lucide-react";
import { fetchGitStats, hasGitSource } from "@/lib/gitStats";
import type { GitStats, PortfolioProject } from "@/lib/types";

interface PortfolioTrackerProps {
  portfolio: PortfolioProject[];
  onToggle: (id: string) => void;
  onAddProject: (project: Omit<PortfolioProject, "id">) => void;
  onEditProject: (id: string, fields: Partial<PortfolioProject>) => void;
  onDeleteProject: (id: string) => void;
}

const inputClass = "w-full p-1 rounded bg-input-bg border border-card-border text-foreground outline-none font-[inherit] text-[0.85rem]";
const labelClass = "block text-[0.7rem] text-muted-foreground mb-1 uppercase";

export default function PortfolioTracker({ portfolio, onToggle, onAddProject, onEditProject, onDeleteProject }: PortfolioTrackerProps) {
  const [gitStats, setGitStats] = useState<{ [id: string]: GitStats }>({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRepoUrl, setNewRepoUrl] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRepoUrl, setEditRepoUrl] = useState("");

  useEffect(() => {
    portfolio.forEach(proj => {
      // repoUrl is injected by the legacy-local-paths migration from the authoritative ID map
      const source = proj.repoUrl || proj.localPath || "";
      if (hasGitSource(source)) {
        fetchGitStats(source)
          .then(stats => {
            setGitStats(prev => ({ ...prev, [proj.id]: stats }));
          })
          .catch(err => console.error(`Error fetching git stats for ${proj.title}:`, err));
      }
    });
  }, [portfolio]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddProject({ title: newTitle.trim(), completed: false, repoUrl: newRepoUrl.trim() || undefined });
    setNewTitle("");
    setNewRepoUrl("");
    setShowAddForm(false);
  };

  const startEdit = (proj: PortfolioProject) => {
    setEditingId(proj.id);
    setEditTitle(proj.title);
    setEditRepoUrl(proj.repoUrl || proj.localPath || "");
  };

  const saveEdit = (id: string) => {
    onEditProject(id, { title: editTitle.trim(), repoUrl: editRepoUrl.trim() || undefined });
    setEditingId(null);
  };

  return (
    <div className="glass-panel p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-card-border pb-3">
        <h2 className="section-title !mb-0">
          <FolderGit2 size={14} strokeWidth={2.5} className="section-icon" />
          Portfolio Deliverables
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn px-2.5 py-1 text-xs"
        >
          {showAddForm ? "Cancel" : "[+ Add]"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-3 bg-surface-muted border border-card-border rounded">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Repo URL (optional, for git stats)</label>
            <input
              type="text"
              value={newRepoUrl}
              onChange={(e) => setNewRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className={inputClass}
            />
          </div>
          <button type="submit" className="btn px-3 py-1.5 text-xs self-start">Add Project</button>
        </form>
      )}

      <div className="flex flex-col mt-2">
        {portfolio.map((proj, idx) => (
          <div
            key={proj.id}
            className={`flex items-center gap-4 py-3 ${idx === portfolio.length - 1 ? "" : "border-b border-card-border"}`}
          >
            {editingId === proj.id ? (
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Title"
                  autoFocus
                />
                <input
                  type="text"
                  value={editRepoUrl}
                  onChange={(e) => setEditRepoUrl(e.target.value)}
                  className={inputClass}
                  placeholder="Repo URL (optional)"
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(proj.id)} className="btn px-3 py-1 text-xs">Save</button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn px-3 py-1 text-xs !bg-transparent !text-muted-foreground !border-card-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="checkbox"
                  className="checkbox-custom"
                  checked={proj.completed}
                  onChange={() => onToggle(proj.id)}
                />
                <div className="flex-1 flex flex-col">
                  <span className={`text-[0.95rem] font-medium transition-colors duration-200 ${proj.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {proj.title}
                  </span>
                  {gitStats[proj.id] && gitStats[proj.id].isRepo && (
                    <div className="text-[0.7rem] text-muted-foreground mt-1 font-mono flex flex-wrap gap-x-2">
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
                          <span className="text-muted-foreground" title={gitStats[proj.id].lastCommitMsg}>
                            last: {(gitStats[proj.id].lastCommitMsg || "").length > 20 ? `${gitStats[proj.id].lastCommitMsg!.slice(0, 20)}...` : gitStats[proj.id].lastCommitMsg} ({gitStats[proj.id].lastCommitTime})
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs shrink-0">
                  <button onClick={() => startEdit(proj)} className="text-accent bg-transparent border-none cursor-pointer">Edit</button>
                  <button onClick={() => onDeleteProject(proj.id)} className="text-red-500 bg-transparent border-none cursor-pointer flex items-center" aria-label="Delete project"><X size={14} strokeWidth={2} /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {portfolio.length === 0 && !showAddForm && (
          <p className="text-subtle-foreground text-[0.85rem] italic py-2">No portfolio projects yet.</p>
        )}
      </div>
    </div>
  );
}
