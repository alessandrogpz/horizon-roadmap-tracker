"use client";

import React, { useEffect, useState } from "react";
import { fetchAppState } from "@/lib/api";

// Simple markdown compiler that supports tables and standard formatting
function renderMarkdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "<p>No roadmap found.</p>";

  const lines = markdown.split("\n");
  const processedLines: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inTable = false;

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

    // Inline formatting: Bold, Italic, Code, Links
    processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    processedLine = processedLine.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/_([^_]+)_/g, "<em>$1</em>");
    processedLine = processedLine.replace(/`([^`]+)`/g, "<code>$1</code>");
    processedLine = processedLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: var(--accent); text-decoration: underline;">$1</a>');

    const trimmed = processedLine.trim();

    // Table parser
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.includes("---")) {
        continue;
      }
      const cells = trimmed.split("|").map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);
      
      if (!inTable) {
        processedLines.push(`<table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.85rem; border: 1px solid var(--card-border);">`);
        processedLines.push(`<thead><tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--card-border);">`);
        cells.forEach(c => processedLines.push(`<th style="padding: 0.75rem 1rem; text-align: left; font-weight: bold; border-right: 1px solid var(--card-border); color: #fff;">${c}</th>`));
        processedLines.push(`</tr></thead><tbody>`);
        inTable = true;
      } else {
        processedLines.push(`<tr style="border-bottom: 1px solid var(--card-border); transition: background 0.2s;">`);
        cells.forEach(c => processedLines.push(`<td style="padding: 0.75rem 1rem; border-right: 1px solid var(--card-border); color: var(--foreground);">${c}</td>`));
        processedLines.push(`</tr>`);
      }
      continue;
    } else {
      if (inTable) {
        processedLines.push("</tbody></table>");
        inTable = false;
      }
    }

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
  if (inTable) processedLines.push("</tbody></table>");

  return processedLines.join("\n");
}

export default function RoadmapPage() {
  const [synced, setSynced] = useState<boolean | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppState()
      .then(async (data) => {
        if (data && data.isSynced) {
          setSynced(true);
          const res = await fetch("/api/roadmap");
          if (res.ok) {
            const json = await res.json();
            setHtmlContent(renderMarkdownToHtml(json.content || ""));
          } else {
            setHtmlContent("<p>Failed to load roadmap content.</p>");
          }
        } else {
          setSynced(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setSynced(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "#a1a1aa", fontFamily: "monospace" }}>Loading roadmap...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--accent)" }}>&gt;_</span> Master Curriculum
        </h1>
        <a href="/" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>&larr; Back to Hub</a>
      </div>
      
      {synced ? (
        <div 
          className="notes-preview-pane glass-panel" 
          style={{ padding: "2rem 2.5rem", display: "block" }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      ) : (
        <div 
          className="glass-panel" 
          style={{ 
            padding: "3rem", 
            textAlign: "center", 
            borderRadius: "8px", 
            border: "1px dashed rgba(239, 68, 68, 0.3)",
            background: "rgba(239, 68, 68, 0.02)"
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#f87171", marginBottom: "0.5rem" }}>Roadmap Locked</h2>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem", maxWidth: "450px", margin: "0 auto 1.5rem" }}>
            The master curriculum is private. Please connect your Google Drive account on the main dashboard to unlock and load your personalized developer roadmap.
          </p>
          <a 
            href="/" 
            style={{ 
              display: "inline-block", 
              padding: "0.5rem 1.5rem", 
              background: "var(--accent)", 
              color: "#000", 
              fontWeight: 700, 
              borderRadius: "4px", 
              textDecoration: "none", 
              fontSize: "0.8rem" 
            }}
          >
            Go to Dashboard & Sync
          </a>
        </div>
      )}
    </div>
  );
}
