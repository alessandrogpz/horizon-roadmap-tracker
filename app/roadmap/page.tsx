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
    // Code blocks
    if (line.trim().startsWith("```")) {
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
      const escapedLine = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      codeBlockContent.push(escapedLine);
      continue;
    }

    let processedLine = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Inline formatting: Bold, Italic, Code
    processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    processedLine = processedLine.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/_([^_]+)_/g, "<em>$1</em>");
    processedLine = processedLine.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Table parser
    if (processedLine.trim().startsWith("|") && processedLine.trim().endsWith("|")) {
      if (processedLine.includes("---")) {
        // Divider row, skip
        continue;
      }
      const cells = processedLine.split("|").map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);
      
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

    // Headers & Blockquotes
    if (processedLine.startsWith("### ")) {
      processedLines.push(`<h3>${processedLine.slice(4)}</h3>`);
    } else if (processedLine.startsWith("## ")) {
      processedLines.push(`<h2>${processedLine.slice(3)}</h2>`);
    } else if (processedLine.startsWith("# ")) {
      processedLines.push(`<h1>${processedLine.slice(2)}</h1>`);
    } else if (processedLine.startsWith("> ")) {
      processedLines.push(`<blockquote>${processedLine.slice(2)}</blockquote>`);
    } else if (processedLine.startsWith("- ") || processedLine.startsWith("* ")) {
      if (!inList) {
        processedLines.push("<ul>");
        inList = true;
      }
      processedLines.push(`<li>${processedLine.slice(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      if (processedLine.trim() === "") {
        processedLines.push("<br />");
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
