import fs from "fs";
import path from "path";
import React from "react";

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

export default async function RoadmapPage() {
  const roadmapPath = path.join(process.cwd(), "engine_dev_roadmap.md");
  let content = "";
  try {
    content = fs.readFileSync(roadmapPath, "utf8");
  } catch (err) {
    content = "# Engine Dev Roadmap\n\nRoadmap file not found at project root.";
  }

  const htmlContent = renderMarkdownToHtml(content);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--accent)" }}>&gt;_</span> Master Curriculum
        </h1>
        <a href="/" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>&larr; Back to Hub</a>
      </div>
      <div 
        className="notes-preview-pane glass-panel" 
        style={{ padding: "2rem 2.5rem", display: "block" }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
