import fs from "fs";
import path from "path";
import React from "react";
import { renderMarkdownToHtml } from "@/lib/markdown";

export default async function DSAPage() {
  const dsaPath = path.join(process.cwd(), "DSA_Study_Guide.md");
  let content = "";
  try {
    content = fs.readFileSync(dsaPath, "utf8");
  } catch (err) {
    content = "# DSA Study Guide\n\nDSA_Study_Guide.md not found at project root.";
  }

  const htmlContent = renderMarkdownToHtml(content, "<p>No DSA guide found.</p>");

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--card-border)", paddingBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ color: "var(--accent)" }}>&gt;_</span> DSA Patterns Guide
        </h1>
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
          <a href="/roadmap" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Master Curriculum &rarr;</a>
          <a href="/" style={{ fontSize: "0.8rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>&larr; Back to Hub</a>
        </div>
      </div>
      <div 
        className="notes-preview-pane glass-panel" 
        style={{ padding: "2rem 2.5rem", display: "block" }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
