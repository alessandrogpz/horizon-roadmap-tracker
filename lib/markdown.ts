// Minimal markdown-to-HTML compiler shared by the notes drawer and the
// roadmap / DSA guide pages. Supports headings, lists, tables, code blocks,
// blockquotes, links, hr and inline bold/italic/code. Input is HTML-escaped
// before formatting is applied.

export function renderMarkdownToHtml(markdown: string, emptyMessage: string = "<p>Nothing to display.</p>"): string {
  if (!markdown.trim()) return emptyMessage;

  const lines = markdown.split("\n");
  const processedLines: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inTable = false;

  const closeList = () => {
    if (inList) {
      processedLines.push("</ul>");
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      processedLines.push("</tbody></table>");
      inTable = false;
    }
  };

  for (const rawLine of lines) {
    const trimmedRaw = rawLine.trim();

    // Horizontal rules
    if (trimmedRaw === "---" || trimmedRaw === "***" || trimmedRaw === "___") {
      closeList();
      closeTable();
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
        closeList();
        closeTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(escapeHtml(rawLine));
      continue;
    }

    // Blockquotes are detected before escaping so ">" isn't consumed as &gt;
    let isBlockquote = false;
    let contentLine = rawLine;
    if (trimmedRaw.startsWith(">")) {
      isBlockquote = true;
      contentLine = trimmedRaw.slice(1);
      if (contentLine.startsWith(" ")) {
        contentLine = contentLine.slice(1);
      }
    }

    let processedLine = escapeHtml(contentLine);

    // Inline formatting
    processedLine = processedLine.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    processedLine = processedLine.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    processedLine = processedLine.replace(/_([^_]+)_/g, "<em>$1</em>");
    processedLine = processedLine.replace(/`([^`]+)`/g, "<code>$1</code>");
    processedLine = processedLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: var(--accent); text-decoration: underline;">$1</a>');

    const trimmed = processedLine.trim();

    // Tables
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (trimmed.includes("---")) {
        continue; // separator row
      }
      const cells = trimmed.split("|").map((c) => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);

      if (!inTable) {
        closeList();
        processedLines.push(`<table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.85rem; border: 1px solid var(--card-border);">`);
        processedLines.push(`<thead><tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--card-border);">`);
        cells.forEach((c) => processedLines.push(`<th style="padding: 0.75rem 1rem; text-align: left; font-weight: bold; border-right: 1px solid var(--card-border); color: #fff;">${c}</th>`));
        processedLines.push(`</tr></thead><tbody>`);
        inTable = true;
      } else {
        processedLines.push(`<tr style="border-bottom: 1px solid var(--card-border); transition: background 0.2s;">`);
        cells.forEach((c) => processedLines.push(`<td style="padding: 0.75rem 1rem; border-right: 1px solid var(--card-border); color: var(--foreground);">${c}</td>`));
        processedLines.push(`</tr>`);
      }
      continue;
    }
    closeTable();

    // Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      processedLines.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    // Lists (flat)
    const listMatch = trimmed.match(/^([-*])\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        processedLines.push("<ul>");
        inList = true;
      }
      processedLines.push(`<li>${listMatch[2]}</li>`);
      continue;
    }

    closeList();

    if (trimmed === "") {
      processedLines.push("<br />");
    } else if (isBlockquote) {
      processedLines.push(`<blockquote>${processedLine}</blockquote>`);
    } else {
      processedLines.push(`<p>${processedLine}</p>`);
    }
  }

  if (inCodeBlock && codeBlockContent.length > 0) {
    processedLines.push(`<pre><code>${codeBlockContent.join("\n")}</code></pre>`);
  }
  if (inList) processedLines.push("</ul>");
  if (inTable) processedLines.push("</tbody></table>");

  return processedLines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
