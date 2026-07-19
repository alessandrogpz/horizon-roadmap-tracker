"use client";

import React, { useState, useEffect, useRef } from "react";
import { fetchGitStats, fetchNotes, saveNotes } from "@/lib/api";

interface Material {
  id: string;
  title: string;
  category: string;
  type: string;
  status: string;
  currentPage: number;
  totalPages: number;
  currentSubject: string;
  link: string;
  localPath?: string;
}

interface MaterialsTrackerProps {
  materials: Material[];
  onStatusChange: (id: string, newStatus: string) => void;
  onProgressChange: (id: string, fields: Partial<Material>) => void;
  onAddMaterial: (material: Omit<Material, "id">) => void;
  onDeleteMaterial: (id: string) => void;
  onOpenLink: (link: string) => void;
}

// Simple but robust markdown to HTML preview compiler
function renderMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) {
    return "<p style='color: #71717a; font-style: italic;'>No notes yet. Start writing in the Write tab...</p>";
  }

  const lines = markdown.split("\n");
  const processedLines: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (let line of lines) {
    const rawLine = line;
    const trimmedRaw = rawLine.trim();

    // Horizontal rules (---)
    if (trimmedRaw === "---" || trimmedRaw === "***" || trimmedRaw === "___") {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      processedLines.push(`<hr style="border: 0; border-top: 1px solid var(--card-border); margin: 2.5rem 0;" />`);
      continue;
    }

    // Code blocks
    if (trimmedRaw.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        processedLines.push(`<pre><code>${codeBlockContent.join("\n")}</code></pre>`);
        codeBlockContent = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      const escapedLine = rawLine
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      codeBlockContent.push(escapedLine);
      continue;
    }

    // Check blockquotes before HTML escaping
    let isBlockquote = false;
    let contentLine = rawLine;
    if (trimmedRaw.startsWith(">")) {
      isBlockquote = true;
      contentLine = trimmedRaw.slice(1);
      if (contentLine.startsWith(" ")) {
        contentLine = contentLine.slice(1);
      }
    }

    let processedLine = contentLine
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Inline formatting: Bold, Italic, Code
    processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    processedLine = processedLine.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/_([^_]+)_/g, "<em>$1</em>");
    processedLine = processedLine.replace(/`([^`]+)`/g, "<code>$1</code>");

    const trimmed = processedLine.trim();

    // Headers (h1 - h6)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      processedLines.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // Lists (handles leading space nesting flatly)
    const listMatch = trimmed.match(/^([-\*])\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        processedLines.push("<ul>");
        inList = true;
      }
      processedLines.push(`<li>${listMatch[2]}</li>`);
      continue;
    }

    // Normal text / blockquotes
    if (inList) {
      processedLines.push("</ul>");
      inList = false;
    }

    if (trimmed === "") {
      processedLines.push("<br />");
    } else {
      if (isBlockquote) {
        processedLines.push(`<blockquote>${processedLine}</blockquote>`);
      } else {
        processedLines.push(`<p>${processedLine}</p>`);
      }
    }
  }

  // Close open structures
  if (inList) processedLines.push("</ul>");

  return processedLines.join("\n");
}

export default function MaterialsTracker({
  materials,
  onStatusChange,
  onProgressChange,
  onAddMaterial,
  onDeleteMaterial,
  onOpenLink,
}: MaterialsTrackerProps) {
  // Add / Edit form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Mathematics");
  const [newType, setNewType] = useState("Book");
  const [newTotalPages, setNewTotalPages] = useState(100);
  const [newLink, setNewLink] = useState("");
  const [newLocalPath, setNewLocalPath] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editTotalPages, setEditTotalPages] = useState(0);
  const [editCurrentPage, setEditCurrentPage] = useState(0);
  const [editCurrentSubject, setEditCurrentSubject] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editLocalPath, setEditLocalPath] = useState("");

  // Git stats state
  const [gitStats, setGitStats] = useState<{ [id: string]: any }>({});

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

  // Fetch Git stats for linked materials on mount and whenever materials change
  // Uses localPath if set (local dev), otherwise falls back to mat.link for GitHub URLs
  useEffect(() => {
    materials.forEach(mat => {
      // repoUrl is injected by migrateLocalPaths from the authoritative ID map — always reliable
      const source = mat.repoUrl || mat.localPath || "";
      if (source.includes("github.com") || source.startsWith("/") || source.startsWith("~")) {
        fetchGitStats(source)
          .then(stats => {
            setGitStats(prev => ({ ...prev, [mat.id]: stats }));
          })
          .catch(err => console.error(`Error fetching git stats for ${mat.title}:`, err));
      }
    });
  }, [materials]);

  const statuses = ["Not Started", "In Progress", "Completed"];
  const categories = ["Mathematics", "Computer Graphics", "Programming Languages", "DSA", "Other"];
  const types = ["Book", "Website", "Course", "Video", "Other"];

  const grouped = materials.reduce((acc, mat) => {
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
    setNewLink("");
    setNewLocalPath("");
    setShowAddForm(false);
  };

  const startEdit = (mat: Material) => {
    setEditingId(mat.id);
    setEditTitle(mat.title);
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
    <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.75rem" }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Materials</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn"
          style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
        >
          {showAddForm ? "Cancel" : "[+ Add]"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.75rem", background: "rgba(255,255,255,0.01)", border: "1px solid var(--card-border)", borderRadius: "4px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.25rem", textTransform: "uppercase" }}>Title</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", outline: "none", fontFamily: "inherit", fontSize: "0.85rem" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.25rem", textTransform: "uppercase" }}>Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", outline: "none", fontFamily: "inherit", fontSize: "0.8rem" }}
              >
                {categories.map(c => <option key={c} value={c} style={{ background: "var(--background)" }}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.25rem", textTransform: "uppercase" }}>Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", outline: "none", fontFamily: "inherit", fontSize: "0.8rem" }}
              >
                {types.map(t => <option key={t} value={t} style={{ background: "var(--background)" }}>{t}</option>)}
              </select>
            </div>
          </div>
          {newType === "Book" && (
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.25rem", textTransform: "uppercase" }}>Total Pages</label>
              <input
                type="number"
                min={1}
                value={newTotalPages}
                onChange={(e) => setNewTotalPages(Number(e.target.value))}
                style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", outline: "none", fontFamily: "inherit", fontSize: "0.85rem" }}
              />
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.25rem", textTransform: "uppercase" }}>Link (URL)</label>
              <input
                type="text"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder="https://..."
                style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", outline: "none", fontFamily: "inherit", fontSize: "0.85rem" }}
              />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <label style={{ display: "block", fontSize: "0.7rem", color: "#a1a1aa", marginBottom: "0.25rem", textTransform: "uppercase" }}>Local Repo Path (Git Stats)</label>
              <input
                type="text"
                value={newLocalPath}
                onChange={(e) => setNewLocalPath(e.target.value)}
                placeholder="~/Documents/..."
                style={{ width: "100%", padding: "0.3rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", outline: "none", fontFamily: "inherit", fontSize: "0.85rem" }}
              />
            </div>
          </div>
          <button type="submit" className="btn" style={{ marginTop: "0.25rem", fontSize: "0.8rem" }}>Save Material</button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h3 style={{ fontSize: "0.75rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", borderLeft: "2px solid var(--accent)", paddingLeft: "0.5rem", marginBottom: "0.75rem" }}>
              {category}
            </h3>
            <div style={{ 
              display: "flex", 
              flexDirection: "column", 
              border: "1px solid var(--card-border)", 
              borderRadius: "6px", 
              background: "rgba(255,255,255,0.01)", 
              overflow: "hidden" 
            }}>
              {items.map((mat, idx) => {
                const isEditing = editingId === mat.id;

                if (isEditing) {
                  return (
                    <div 
                      key={mat.id} 
                      style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        gap: "0.75rem", 
                        padding: "1rem", 
                        background: "rgba(14, 165, 233, 0.02)", 
                        borderLeft: "3px solid var(--accent)",
                        borderBottom: idx === items.length - 1 ? "none" : "1px solid var(--card-border)"
                      }}
                    >
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.85rem" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 120px" }}>
                          <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Category</label>
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.8rem" }}
                          >
                            {categories.map(c => <option key={c} value={c} style={{ background: "var(--background)" }}>{c}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: "1 1 120px" }}>
                          <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Type</label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.8rem" }}
                          >
                            {types.map(t => <option key={t} value={t} style={{ background: "var(--background)" }}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 120px" }}>
                          <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.8rem" }}
                          >
                            {statuses.map(s => <option key={s} value={s} style={{ background: "var(--background)" }}>{s}</option>)}
                          </select>
                        </div>
                        {editType === "Book" && (
                          <div style={{ flex: "1 1 120px" }}>
                            <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Total Pages</label>
                            <input
                              type="number"
                              value={editTotalPages}
                              onChange={(e) => setEditTotalPages(Number(e.target.value))}
                              style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.85rem" }}
                            />
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 180px" }}>
                          <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Link (URL)</label>
                          <input
                            type="text"
                            value={editLink}
                            onChange={(e) => setEditLink(e.target.value)}
                            style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.85rem" }}
                          />
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                          <label style={{ fontSize: "0.7rem", color: "#a1a1aa", textTransform: "uppercase" }}>Local Repo Path</label>
                          <input
                            type="text"
                            value={editLocalPath}
                            onChange={(e) => setEditLocalPath(e.target.value)}
                            style={{ width: "100%", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.85rem" }}
                          />
                        </div>
                      </div>

                      {editStatus !== "Not Started" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {editType === "Book" && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.65rem", color: "#71717a", width: "70px", textTransform: "uppercase", fontFamily: "monospace", fontWeight: "bold", letterSpacing: "0.05em" }}>PAGE</span>
                              <input
                                type="number"
                                value={editCurrentPage}
                                onChange={(e) => setEditCurrentPage(Number(e.target.value))}
                                style={{ width: "60px", padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.85rem", textAlign: "center" }}
                              />
                              <span style={{ fontSize: "0.8rem", color: "#a1a1aa" }}>/ {editTotalPages}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.65rem", color: "#71717a", width: "70px", textTransform: "uppercase", fontFamily: "monospace", fontWeight: "bold", letterSpacing: "0.05em" }}>SUBJECT</span>
                            <input
                              type="text"
                              value={editCurrentSubject}
                              onChange={(e) => setEditCurrentSubject(e.target.value)}
                              style={{ flex: 1, minWidth: 0, padding: "0.25rem", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border)", color: "#fff", fontFamily: "inherit", fontSize: "0.85rem" }}
                            />
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginTop: "0.25rem" }}>
                        <button
                          type="button"
                          onClick={() => onDeleteMaterial(mat.id)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: "4px",
                            padding: "0.2rem 0.5rem",
                            fontSize: "0.75rem",
                            cursor: "pointer"
                          }}
                        >
                          Delete
                        </button>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{
                              background: "transparent",
                              color: "#a1a1aa",
                              border: "1px solid var(--card-border)",
                              borderRadius: "4px",
                              padding: "0.2rem 0.5rem",
                              fontSize: "0.75rem",
                              cursor: "pointer"
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEdit(mat.id)}
                            className="btn"
                            style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
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
                    style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      gap: "0.5rem", 
                      padding: "0.75rem 1rem", 
                      background: "transparent", 
                      borderLeft: `3px solid ${getLeftBorderColor(mat.status)}`,
                      borderBottom: idx === items.length - 1 ? "none" : "1px solid var(--card-border)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {mat.link ? (
                          <div 
                            onClick={() => onOpenLink(mat.link)}
                            className="link-title"
                            style={{ fontWeight: 600, fontSize: "0.9rem", display: "inline-block" }}
                            title={`Open ${mat.link}`}
                          >
                            {mat.title}
                          </div>
                        ) : (
                          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#fff" }}>
                            {mat.title}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.1rem" }}>
                          <span style={{ fontSize: "0.65rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                            {mat.type}
                          </span>
                        </div>
                        {gitStats[mat.id] && gitStats[mat.id].isRepo && (
                          <div style={{ fontSize: "0.7rem", color: "#a1a1aa", marginTop: "0.25rem", fontFamily: "monospace", display: "flex", flexWrap: "wrap", columnGap: "0.5rem", rowGap: "0.1rem" }}>
                            <span>branch: <span style={{ color: "var(--accent)" }}>{gitStats[mat.id].branch}</span></span>
                            <span>|</span>
                            {gitStats[mat.id].uncommittedCount > 0 ? (
                              <span style={{ color: "var(--warning)" }}>{gitStats[mat.id].uncommittedCount} modified</span>
                            ) : (
                              <span style={{ color: "var(--success)" }}>clean</span>
                            )}
                            {gitStats[mat.id].lastCommitMsg && (
                              <>
                                <span>|</span>
                                <span style={{ color: "#71717a" }} title={gitStats[mat.id].lastCommitMsg}>
                                  last: {gitStats[mat.id].lastCommitMsg.length > 20 ? `${gitStats[mat.id].lastCommitMsg.slice(0, 20)}...` : gitStats[mat.id].lastCommitMsg} ({gitStats[mat.id].lastCommitTime})
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "1rem", flexShrink: 0 }}>
                        <button
                          onClick={() => openNotes(mat.id, mat.title)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent)",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            padding: "0.1rem 0.3rem",
                            fontFamily: "inherit",
                            fontWeight: 500
                          }}
                        >
                          Notes
                        </button>
                        <button
                          onClick={() => startEdit(mat)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#a1a1aa",
                            cursor: "pointer",
                            fontSize: "0.7rem",
                            padding: "0.1rem 0.3rem",
                            fontFamily: "inherit"
                          }}
                        >
                          Edit
                        </button>
                        <span style={{ 
                          fontSize: "0.7rem", 
                          color: mat.status === "Completed" ? "var(--success)" : mat.status === "In Progress" ? "var(--accent)" : "#71717a",
                          textTransform: "uppercase", 
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          letterSpacing: "0.05em",
                          padding: "0.15rem 0.4rem",
                          border: `1px solid ${mat.status === "Completed" ? "rgba(16, 185, 129, 0.2)" : mat.status === "In Progress" ? "rgba(14, 165, 233, 0.2)" : "rgba(255,255,255,0.06)"}`,
                          background: mat.status === "Completed" ? "rgba(16, 185, 129, 0.05)" : mat.status === "In Progress" ? "rgba(14, 165, 233, 0.05)" : "transparent",
                          borderRadius: "4px",
                          whiteSpace: "nowrap"
                        }}>
                          {mat.status}
                        </span>
                      </div>
                    </div>

                    {/* Progress properties as static display metrics */}
                    {mat.status !== "Not Started" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.25rem", borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: "0.5rem" }}>
                        {mat.type === "Book" && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.65rem", color: "#71717a", width: "70px", textTransform: "uppercase", fontFamily: "monospace", fontWeight: "bold", letterSpacing: "0.05em" }}>PAGE</span>
                            <span style={{
                              fontSize: "0.8rem",
                              color: "#e4e4e7",
                              fontFamily: "monospace"
                            }}>
                              {mat.currentPage || 0} / {mat.totalPages || 100}
                            </span>
                          </div>
                        )}
                        {mat.currentSubject && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.65rem", color: "#71717a", width: "70px", textTransform: "uppercase", fontFamily: "monospace", fontWeight: "bold", letterSpacing: "0.05em" }}>SUBJECT</span>
                            <span style={{
                              fontSize: "0.8rem",
                              color: "#e4e4e7"
                            }}>
                              {mat.currentSubject}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Notes Drawer Overlay */}
      <div 
        className={`notes-drawer-overlay ${activeNotesId ? "open" : ""}`}
        onClick={closeNotes}
      />

      {/* Notes Drawer */}
      <div className={`notes-drawer ${activeNotesId ? "open" : ""}`}>
        <div className="notes-drawer-header">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0, flex: 1, paddingRight: "1rem" }}>
            <span style={{ fontSize: "0.65rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", fontWeight: 600 }}>
              Study Notes
            </span>
            <h3 
              style={{ fontSize: "1rem", fontWeight: 600, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={activeNotesTitle}
            >
              {activeNotesTitle}
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
            <span style={{ fontSize: "0.7rem", color: notesStatus === "error" ? "#ef4444" : "#a1a1aa", fontFamily: "monospace" }}>
              {notesStatus === "loading" && "Loading..."}
              {notesStatus === "saving" && "Saving..."}
              {notesStatus === "saved" && "Saved ✓"}
              {notesStatus === "error" && "Error saving!"}
              {notesStatus === "idle" && ""}
            </span>
            <button 
              onClick={closeNotes}
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.2rem", padding: "0.2rem", display: "flex", alignItems: "center" }}
            >
              ✕
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
              dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(notesContent) }}
            />
          )}
        </div>

        <div className="notes-drawer-footer">
          <span style={{ fontSize: "0.7rem", color: "#71717a" }}>
            Markdown supported • Autosaves
          </span>
          <button 
            onClick={() => activeNotesId && performSave(activeNotesId, notesContent)}
            className="btn"
            style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem" }}
            disabled={notesStatus === "loading" || notesStatus === "saving"}
          >
            Save Now
          </button>
        </div>
      </div>
    </div>
  );
}
