import fs from "fs";
import path from "path";
import React from "react";
import Link from "next/link";
import { renderMarkdownToHtml } from "@/lib/markdown";

export default async function DSAPage() {
  const dsaPath = path.join(process.cwd(), "DSA_Study_Guide.md");
  let content = "";
  try {
    content = fs.readFileSync(dsaPath, "utf8");
  } catch {
    content = "# DSA Study Guide\n\nDSA_Study_Guide.md not found at project root.";
  }

  const htmlContent = renderMarkdownToHtml(content, "<p>No DSA guide found.</p>");

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <div className="flex justify-between items-center mb-6 border-b border-card-border pb-4">
        <h1 className="text-2xl font-bold m-0 flex items-center gap-2">
          <span className="text-accent">&gt;_</span> DSA Patterns Guide
        </h1>
        <div className="flex gap-5 items-center">
          <Link href="/roadmap" className="text-[0.8rem] text-accent no-underline font-semibold">Master Curriculum &rarr;</Link>
          <Link href="/" className="text-[0.8rem] text-accent no-underline font-semibold">&larr; Back to Hub</Link>
        </div>
      </div>
      <div
        className="notes-preview-pane glass-panel block px-10 py-8"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
