"use client";

import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Check, ChevronDown, X } from "lucide-react";
import { fetchNotes, saveNotes } from "@/lib/notes";
import { renderMarkdownToHtml } from "@/lib/markdown";
import type { Material } from "@/lib/types";
import { useGitStats } from "@/components/useGitStats";
import { categoriesFor, MATERIAL_STATUSES, MATERIAL_TYPES, searchUrlFor } from "@/lib/materialOptions";
import Portal from "@/components/Portal";
import { LIMITS } from "@/lib/limits";

interface MaterialsTrackerProps {
  materials: Material[];
  onStatusChange: (id: string, newStatus: string) => void;
  onProgressChange: (id: string, fields: Partial<Material>) => void;
  onAddMaterial: (material: Omit<Material, "id">) => void;
  onDeleteMaterial: (id: string) => void;
  onArchiveChange: (id: string, archived: boolean) => void;
  onOpenLink: (link: string) => void;
}

/** Which category groups are folded shut. A per-device view preference, so it
 *  lives in localStorage rather than on the track (which syncs to Drive). */
const COLLAPSED_KEY = "horizon-materials-collapsed";

/** How many of a category's materials the panel shows before asking.
 *  Twelve is roughly a screen of rows on a laptop — enough that the common
 *  case never sees the control at all, few enough that a long reading list
 *  cannot bury the panels under it. */
const GROUP_PREVIEW = 12;

function readCollapsedCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

const inputClass = "w-full p-1 rounded bg-input-bg border border-card-border text-foreground outline-none font-[inherit] type-body";
const selectClass = "w-full p-1 rounded bg-input-bg border border-card-border text-foreground outline-none font-[inherit] type-label";
const labelClass = "block type-caption text-muted-foreground mb-1 uppercase";
const metricLabelClass = "type-micro text-muted-foreground w-[70px] uppercase font-mono font-bold tracking-[0.05em]";

export default function MaterialsTracker({
  materials,
  onProgressChange,
  onAddMaterial,
  onDeleteMaterial,
  onArchiveChange,
  onOpenLink,
}: MaterialsTrackerProps) {
  // Add / Edit form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newCategory, setNewCategory] = useState("Mathematics");
  const [newType, setNewType] = useState("Book");
  const [newTotalPages, setNewTotalPages] = useState(100);
  const [newLink, setNewLink] = useState("");
  const [newLocalPath, setNewLocalPath] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editTotalPages, setEditTotalPages] = useState(0);
  const [editCurrentPage, setEditCurrentPage] = useState(0);
  const [editCurrentSubject, setEditCurrentSubject] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editLocalPath, setEditLocalPath] = useState("");

  // Git stats state

  // Collapsed category groups
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(readCollapsedCategories()));
  // The archived group starts folded: it's history, not today's reading list.
  const [showArchived, setShowArchived] = useState(false);
  // Categories the reader has asked to see in full. A reading list is the one
  // panel here with no natural ceiling — sixty books in one category made this
  // panel 14,905 pixels tall, twenty screens of it, with seven other panels
  // stranded underneath. The first dozen is the list; the rest is on request.
  const [shownInFull, setShownInFull] = useState<Set<string>>(() => new Set());

  const activeMaterials = materials.filter(mat => !mat.archived);
  const archivedMaterials = materials.filter(mat => mat.archived);

  const toggleCategory = (category: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (!next.delete(category)) next.add(category);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage unavailable (private mode) — folding still works for this session.
      }
      return next;
    });
  };

  // Notes drawer states
  const [activeNotesId, setActiveNotesId] = useState<string | null>(null);
  const [activeNotesTitle, setActiveNotesTitle] = useState("");
  const [notesContent, setNotesContent] = useState("");
  const [notesTab, setNotesTab] = useState<"write" | "preview">("write");
  const [notesStatus, setNotesStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestContentRef = useRef(notesContent);

  useEffect(() => {
    latestContentRef.current = notesContent;
  }, [notesContent]);

  // Which materials have a repo behind them, as a plain string. The effect
  // keys on this rather than on `materials`, whose identity changes on every
  // unrelated workspace edit — that made the stats re-fetch on every ticked
  // checkbox and burned the GitHub API's 60-requests/hour budget.
  // repoUrl (injected by migration) is the primary source. Archived materials
  // don't show stats, so they don't spend any of that budget either.
  const gitStats = useGitStats(activeMaterials.map(mat => ({ id: mat.id, source: mat.repoUrl || mat.localPath || "" })));

  const statuses = MATERIAL_STATUSES;
  // Includes any category already in use, so editing a material can't silently
  // reassign one that predates the canonical list.
  const categories = categoriesFor(materials);
  const types = MATERIAL_TYPES;

  const grouped = activeMaterials.reduce((acc, mat) => {
    const cat = mat.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mat);
    return acc;
  }, {} as Record<string, Material[]>);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddMaterial({
      title: newTitle,
      author: newAuthor.trim(),
      category: newCategory,
      type: newType,
      status: "Not Started",
      currentPage: 0,
      totalPages: newTotalPages,
      currentSubject: "",
      link: newLink,
      localPath: newLocalPath,
    });
    setNewTitle("");
    setNewAuthor("");
    setNewLink("");
    setNewLocalPath("");
    setShowAddForm(false);
  };

  const startEdit = (mat: Material) => {
    setEditingId(mat.id);
    setEditTitle(mat.title);
    setEditAuthor(mat.author || "");
    setEditCategory(mat.category);
    setEditType(mat.type);
    setEditStatus(mat.status);
    setEditTotalPages(mat.totalPages || 0);
    setEditCurrentPage(mat.currentPage || 0);
    setEditCurrentSubject(mat.currentSubject || "");
    setEditLink(mat.link || "");
    setEditLocalPath(mat.localPath || "");
  };

  const saveEdit = (id: string) => {
    onProgressChange(id, {
      title: editTitle,
      author: editAuthor.trim(),
      category: editCategory,
      type: editType,
      status: editStatus,
      totalPages: editTotalPages,
      currentPage: editCurrentPage,
      currentSubject: editCurrentSubject,
      link: editLink,
      localPath: editLocalPath,
    });
    setEditingId(null);
  };

  const getLeftBorderColor = (status: string) => {
    if (status === "Completed") return "var(--success)";
    if (status === "In Progress") return "var(--accent)";
    return "var(--card-border)";
  };

  // Notes drawer save function
  const performSave = async (id: string, content: string) => {
    setNotesStatus("saving");
    try {
      await saveNotes(id, content);
      setNotesStatus("saved");
      setTimeout(() => setNotesStatus(prev => prev === "saved" ? "idle" : prev), 2000);
    } catch (err) {
      console.error("Failed to save notes:", err);
      setNotesStatus("error");
    }
  };

  // Notes change handler (debounced)
  const handleNotesChange = (content: string) => {
    setNotesContent(content);
    setNotesStatus("idle");

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (activeNotesId) {
      saveTimeoutRef.current = setTimeout(() => {
        performSave(activeNotesId, latestContentRef.current);
      }, 1500);
    }
  };

  const handleNotesBlur = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (activeNotesId) {
      performSave(activeNotesId, notesContent);
    }
  };

  const openNotes = async (id: string, title: string) => {
    // If opening a different note, save the current one first
    if (activeNotesId && activeNotesId !== id) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await performSave(activeNotesId, latestContentRef.current);
    }

    setActiveNotesId(id);
    setActiveNotesTitle(title);
    setNotesTab("write");
    setNotesStatus("loading");
    setNotesContent("");

    try {
      const data = await fetchNotes(id);
      setNotesContent(data.content || "");
      setNotesStatus("idle");
    } catch (err) {
      console.error("Failed to fetch notes:", err);
      setNotesStatus("error");
    }
  };

  const closeNotes = async () => {
    if (activeNotesId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      await performSave(activeNotesId, latestContentRef.current);
    }
    setActiveNotesId(null);
  };

  return (
    <div className="glass-panel flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-card-border pb-3">
        <h2 className="section-title !mb-0">
          <BookOpen size={14} strokeWidth={2.5} className="section-icon" />
          Materials
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn px-2.5 py-1 type-caption"
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
              maxLength={LIMITS.title}
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Author</label>
            <input
              type="text"
              maxLength={LIMITS.title}
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-[1_1_120px]">
              <label className={labelClass}>Category</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={selectClass}>
                {categories.map(c => <option key={c} value={c} className="bg-background">{c}</option>)}
              </select>
            </div>
            <div className="flex-[1_1_120px]">
              <label className={labelClass}>Type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className={selectClass}>
                {types.map(t => <option key={t} value={t} className="bg-background">{t}</option>)}
              </select>
            </div>
          </div>
          {newType === "Book" && (
            <div>
              <label className={labelClass}>Total Pages</label>
              <input
                type="number"
                min={1}
                value={newTotalPages}
                onChange={(e) => setNewTotalPages(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-[1_1_180px]">
              <label className={labelClass}>Link (URL)</label>
              <input
                type="text"
                maxLength={LIMITS.url}
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="https://..."
                className={inputClass}
              />
            </div>
            <div className="flex-[1_1_180px]">
              <label className={labelClass}>Local Repo Path (Git Stats)</label>
              <input
                type="text"
                maxLength={LIMITS.url}
                value={newLocalPath}
                onChange={(e) => setNewLocalPath(e.target.value)}
                placeholder="~/Documents/..."
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" className="btn mt-1 type-label">Save Material</button>
        </form>
      )}

      <div className="flex flex-col gap-5">
        {Object.entries(grouped).map(([category, allItems]) => {
          const isCollapsed = collapsed.has(category);
          const groupId = `materials-group-${category.replace(/\W+/g, "-").toLowerCase()}`;
          const full = shownInFull.has(category);
          const items = full ? allItems : allItems.slice(0, GROUP_PREVIEW);
          const hidden = allItems.length - items.length;

          return (
          <div key={category}>
            <h3 className={isCollapsed ? "" : "mb-3"}>
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                aria-expanded={!isCollapsed}
                aria-controls={groupId}
                className="flex w-full items-center gap-1.5 py-0.5 type-caption text-accent uppercase tracking-[0.05em] border-l-2 border-accent pl-2 font-bold bg-transparent text-left cursor-pointer hover:opacity-75 transition-opacity"
              >
                <ChevronDown
                  size={13}
                  strokeWidth={3}
                  className={`shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <span>{category}</span>
                <span className="text-muted-foreground font-mono font-normal">({allItems.length})</span>
              </button>
            </h3>
            <div
              id={groupId}
              className={`${isCollapsed ? "hidden" : "flex"} flex-col border border-card-border rounded-md bg-surface-muted overflow-hidden`}
            >
              {items.map((mat, idx) => {
                const isEditing = editingId === mat.id;
                const stats = gitStats[mat.id];

                if (isEditing) {
                  return (
                    <div
                      key={mat.id}
                      className={`flex flex-col gap-3 p-4 bg-accent/[0.02] border-l-[3px] border-l-accent ${idx === items.length - 1 ? "" : "border-b border-card-border"}`}
                    >
                      <div>
                        <label className={labelClass}>Title</label>
                        <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} maxLength={LIMITS.title} />
                      </div>
                      <div>
                        <label className={labelClass}>Author</label>
                        <input
                          type="text"
                          maxLength={LIMITS.title}
                          value={editAuthor}
                          onChange={(e) => setEditAuthor(e.target.value)}
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex-[1_1_120px]">
                          <label className={labelClass}>Category</label>
                          <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className={selectClass}>
                            {categories.map(c => <option key={c} value={c} className="bg-background">{c}</option>)}
                          </select>
                        </div>
                        <div className="flex-[1_1_120px]">
                          <label className={labelClass}>Type</label>
                          <select value={editType} onChange={(e) => setEditType(e.target.value)} className={selectClass}>
                            {types.map(t => <option key={t} value={t} className="bg-background">{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex-[1_1_120px]">
                          <label className={labelClass}>Status</label>
                          <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={selectClass}>
                            {statuses.map(s => <option key={s} value={s} className="bg-background">{s}</option>)}
                          </select>
                        </div>
                        {editType === "Book" && (
                          <div className="flex-[1_1_120px]">
                            <label className={labelClass}>Total Pages</label>
                            <input type="number" value={editTotalPages} onChange={(e) => setEditTotalPages(Number(e.target.value))} className={inputClass} />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <div className="flex-[1_1_180px]">
                          <label className={labelClass}>Link (URL)</label>
                          <input type="text" value={editLink} onChange={(e) => setEditLink(e.target.value)} className={inputClass} maxLength={LIMITS.url} />
                        </div>
                        <div className="flex-[1_1_180px]">
                          <label className={labelClass}>Local Repo Path</label>
                          <input type="text" value={editLocalPath} onChange={(e) => setEditLocalPath(e.target.value)} className={inputClass} maxLength={LIMITS.url} />
                        </div>
                      </div>

                      {editStatus !== "Not Started" && (
                        <div className="flex flex-col gap-2">
                          {editType === "Book" && (
                            <div className="flex items-center gap-2">
                              <span className={metricLabelClass}>PAGE</span>
                              <input
                                type="number"
                                value={editCurrentPage}
                                onChange={(e) => setEditCurrentPage(Number(e.target.value))}
                                className="w-[60px] p-1 rounded bg-input-bg border border-card-border text-foreground font-[inherit] type-body text-center outline-none"
                              />
                              <span className="type-label text-muted-foreground">/ {editTotalPages}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className={metricLabelClass}>SUBJECT</span>
                            <input
                              type="text"
                              maxLength={LIMITS.title}
                              value={editCurrentSubject}
                              onChange={(e) => setEditCurrentSubject(e.target.value)}
                              className="flex-1 min-w-0 p-1 rounded bg-input-bg border border-card-border text-foreground font-[inherit] type-body outline-none"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => onDeleteMaterial(mat.id)}
                          className="bg-danger/10 text-danger border border-danger/30 rounded px-2 py-1 type-caption cursor-pointer"
                        >
                          Delete
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="bg-transparent text-muted-foreground border border-card-border rounded px-2 py-1 type-caption cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(mat.id)}
                            className="btn px-2 py-1 type-caption"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={mat.id}
                    className={`flex flex-col gap-2 px-4 py-3 bg-transparent border-l-[3px] ${idx === items.length - 1 ? "" : "border-b border-card-border"}`}
                    style={{ borderLeftColor: getLeftBorderColor(mat.status) }}
                  >
                    {/* Wraps on a narrow panel. The four controls beside the
                        title are `shrink-0` and come to about 190 points
                        together, which on a 288-point panel left the title
                        column nothing at all: it collapsed to zero width and
                        the row showed its buttons and no name. Given room they
                        still share a line; without it they take their own. */}
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <div className="min-w-0 flex-1 basis-[11rem]">
                        {mat.link ? (
                          <div
                            onClick={() => onOpenLink(mat.link)}
                            className="link-title line-clamp-2 font-semibold type-subhead"
                            title={`${mat.title} — opens ${mat.link}`}
                          >
                            {mat.title}
                          </div>
                        ) : (
                          <div className="line-clamp-2 font-semibold type-subhead text-foreground" title={mat.title}>
                            {mat.title}
                          </div>
                        )}
                        {mat.author && (
                          <div className="type-label text-muted-foreground mt-0.5">{mat.author}</div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="type-micro text-accent uppercase tracking-[0.05em] font-mono">
                            {mat.type}
                          </span>
                          {/* No stored link — offer a search built from the title
                              and author rather than pretending to know the URL. */}
                          {!mat.link && (
                            <button
                              onClick={() => onOpenLink(searchUrlFor(mat))}
                              className="cursor-pointer border-none bg-transparent p-0 type-micro uppercase tracking-[0.05em] font-mono text-muted-foreground underline hover:text-foreground"
                              title={`Search the web for "${mat.title}"`}
                            >
                              find
                            </button>
                          )}
                        </div>
                        {stats && stats.isRepo && (
                          <div className="type-caption text-muted-foreground mt-1 font-mono flex flex-wrap gap-x-2 gap-y-px">
                            <span>branch: <span className="text-accent">{stats.branch}</span></span>
                            <span>|</span>
                            {(stats.uncommittedCount ?? 0) > 0 ? (
                              <span className="text-warning">{stats.uncommittedCount} modified</span>
                            ) : (
                              <span className="text-success">clean</span>
                            )}
                            {stats.lastCommitMsg && (
                              <>
                                <span>|</span>
                                <span className="text-muted-foreground" title={stats.lastCommitMsg}>
                                  last: {stats.lastCommitMsg.length > 20 ? `${stats.lastCommitMsg.slice(0, 20)}...` : stats.lastCommitMsg} ({stats.lastCommitTime})
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => openNotes(mat.id, mat.title)}
                          className="bg-transparent border-none text-accent cursor-pointer type-caption px-1 py-px font-[inherit] font-medium"
                        >
                          Notes
                        </button>
                        <button
                          onClick={() => startEdit(mat)}
                          className="bg-transparent border-none text-muted-foreground cursor-pointer type-caption px-1 py-px font-[inherit]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onArchiveChange(mat.id, true)}
                          className="bg-transparent border-none text-muted-foreground cursor-pointer type-caption px-1 py-px font-[inherit]"
                          title="Move to Archived. Nothing is deleted, and you can unarchive it any time."
                        >
                          Archive
                        </button>
                        <span className={`type-caption uppercase font-mono font-bold tracking-[0.05em] px-1.5 py-0.5 border rounded whitespace-nowrap ${
                          mat.status === "Completed"
                            ? "text-success border-success/20 bg-success/5"
                            : mat.status === "In Progress"
                              ? "text-accent border-accent/20 bg-accent/5"
                              : "text-muted-foreground border-card-border bg-transparent"
                        }`}>
                          {mat.status}
                        </span>
                      </div>
                    </div>

                    {/* Progress properties as static display metrics */}
                    {mat.status !== "Not Started" && (
                      <div className="flex flex-col gap-1.5 mt-1 border-t border-dashed border-card-border pt-2">
                        {mat.type === "Book" && (
                          <div className="flex items-center gap-2">
                            <span className={metricLabelClass}>PAGE</span>
                            <span className="type-label text-foreground font-mono">
                              {mat.currentPage || 0} / {mat.totalPages || 100}
                            </span>
                          </div>
                        )}
                        {mat.currentSubject && (
                          <div className="flex items-center gap-2">
                            <span className={metricLabelClass}>SUBJECT</span>
                            <span className="type-label text-foreground">
                              {mat.currentSubject}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* The rest of a long category, one click away. Inside the list
                  rather than under it, so it reads as the list continuing. */}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setShownInFull(prev => new Set(prev).add(category))}
                  className="w-full cursor-pointer border-none bg-transparent px-3 py-2.5 text-left type-label text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  Show {hidden} more in {category}
                </button>
              )}
            </div>
          </div>
          );
        })}

        {archivedMaterials.length > 0 && (
          <div>
            <h3 className={showArchived ? "mb-3" : ""}>
              <button
                type="button"
                onClick={() => setShowArchived(open => !open)}
                aria-expanded={showArchived}
                aria-controls="materials-group-archived"
                className="flex w-full items-center gap-1.5 py-0.5 type-caption text-muted-foreground uppercase tracking-[0.05em] border-l-2 border-card-border pl-2 font-bold bg-transparent text-left cursor-pointer hover:text-foreground transition-colors"
              >
                <ChevronDown
                  size={13}
                  strokeWidth={3}
                  className={`shrink-0 transition-transform duration-200 ${showArchived ? "" : "-rotate-90"}`}
                />
                <span>Archived</span>
                <span className="font-mono font-normal">({archivedMaterials.length})</span>
              </button>
            </h3>
            <div
              id="materials-group-archived"
              className={`${showArchived ? "flex" : "hidden"} flex-col border border-card-border rounded-md bg-surface-muted overflow-hidden`}
            >
              {archivedMaterials.map((mat, idx) => (
                <div
                  key={mat.id}
                  className={`flex justify-between items-start gap-4 px-4 py-3 ${idx === archivedMaterials.length - 1 ? "" : "border-b border-card-border"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="line-clamp-2 font-semibold type-subhead text-muted-foreground" title={mat.title}>{mat.title}</div>
                    {mat.author && (
                      <div className="type-label text-muted-foreground mt-0.5">{mat.author}</div>
                    )}
                    <div className="type-micro text-muted-foreground uppercase tracking-[0.05em] font-mono mt-0.5">
                      {mat.type} · {mat.category || "Other"} · {mat.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openNotes(mat.id, mat.title)}
                      className="bg-transparent border-none text-accent cursor-pointer type-caption px-1 py-px font-[inherit] font-medium"
                    >
                      Notes
                    </button>
                    <button
                      onClick={() => onArchiveChange(mat.id, false)}
                      className="bg-transparent border-none text-muted-foreground cursor-pointer type-caption px-1 py-px font-[inherit]"
                    >
                      Unarchive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Both of these are position:fixed and stay mounted (closed means
          translated off-screen, which is what animates the slide). Rendered
          into <body> rather than here: this panel gets a transform for the
          length of a drag, and a transformed ancestor would make that
          off-screen translation relative to the panel instead of the viewport,
          sliding the "closed" drawer into view mid-drag. */}
      <Portal>
        <div
          className={`notes-drawer-overlay ${activeNotesId ? "open" : ""}`}
          onClick={closeNotes}
        />

        <div className={`notes-drawer ${activeNotesId ? "open" : ""}`}>
        <div className="notes-drawer-header">
          <div className="flex flex-col gap-1 min-w-0 flex-1 pr-4">
            {/* The title leads; what the drawer is goes under it. This was a
                tracked uppercase "STUDY NOTES" sitting above the heading — a
                label over a heading, which is the one device the heading can
                always carry itself. */}
            <h3
              className="type-prose font-semibold text-foreground m-0 overflow-hidden text-ellipsis whitespace-nowrap"
              title={activeNotesTitle}
            >
              {activeNotesTitle}
            </h3>
            <span className="type-caption text-muted-foreground">Study notes</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className={`type-caption font-mono inline-flex items-center gap-1 ${notesStatus === "error" ? "text-danger" : "text-muted-foreground"}`}>
              {notesStatus === "loading" && "Loading..."}
              {notesStatus === "saving" && "Saving..."}
              {notesStatus === "saved" && (<><Check size={12} strokeWidth={2.5} /> Saved</>)}
              {notesStatus === "error" && "Error saving!"}
              {notesStatus === "idle" && ""}
            </span>
            <button
              onClick={closeNotes}
              className="tap-44 bg-transparent border-none text-foreground cursor-pointer p-1 flex items-center hover:text-muted-foreground transition-colors"
              aria-label="Close notes"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="notes-drawer-tabs">
          <button
            className={`notes-tab-btn ${notesTab === "write" ? "active" : ""}`}
            onClick={() => setNotesTab("write")}
          >
            Write
          </button>
          <button
            className={`notes-tab-btn ${notesTab === "preview" ? "active" : ""}`}
            onClick={() => setNotesTab("preview")}
          >
            Preview
          </button>
        </div>

        <div className="notes-content-area">
          {notesTab === "write" ? (
            <textarea
            maxLength={LIMITS.document}
              aria-label="Material notes, in Markdown"
              className="notes-editor-textarea"
              placeholder="Write your study notes here using Markdown...&#10;&#10;Use # for title&#10;Use ## for sections&#10;Use - for list items&#10;Use `code` for inline code"
              value={notesContent}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
              disabled={notesStatus === "loading"}
            />
          ) : (
            <div
              className="notes-preview-pane"
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(notesContent, "<p style='color: #71717a; font-style: italic;'>No notes yet. Start writing in the Write tab...</p>") }}
            />
          )}
        </div>

        <div className="notes-drawer-footer">
          <span className="type-caption text-muted-foreground">
            Markdown supported • Autosaves
          </span>
          <button
            onClick={() => activeNotesId && performSave(activeNotesId, notesContent)}
            className="btn px-3 py-1 type-caption disabled:opacity-50"
            disabled={notesStatus === "loading" || notesStatus === "saving"}
          >
            Save Now
          </button>
          </div>
        </div>
      </Portal>
    </div>
  );
}
