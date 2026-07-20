import { describe, it, expect } from "vitest";
import { renderMarkdownToHtml } from "../markdown";

describe("renderMarkdownToHtml security", () => {
  it("does not let a crafted link URL break out of the href attribute", () => {
    const html = renderMarkdownToHtml('[x](" onmouseover="alert(1)")');
    expect(html).not.toContain('onmouseover="alert(1)"');
    // The quote from the raw URL must come through entity-encoded, not literal.
    expect(html).toContain("&quot;");
  });

  it("blocks javascript: scheme links, replacing the href with a safe no-op", () => {
    const html = renderMarkdownToHtml("[click me](javascript:alert(1))");
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).toContain('href="#"');
    expect(html).toContain("click me");
  });

  it("blocks data: scheme links", () => {
    const html = renderMarkdownToHtml("[x](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toMatch(/href="data:/);
  });

  it("still allows normal https links through untouched", () => {
    const html = renderMarkdownToHtml("[Anthropic](https://anthropic.com)");
    expect(html).toContain('href="https://anthropic.com"');
  });

  it("allows relative and anchor links", () => {
    expect(renderMarkdownToHtml("[a](/foo)")).toContain('href="/foo"');
    expect(renderMarkdownToHtml("[a](#section)")).toContain('href="#section"');
  });

  it("escapes quotes and apostrophes in plain text without altering how they read", () => {
    const html = renderMarkdownToHtml(`She said "hi" and it's fine.`);
    expect(html).toContain("&quot;hi&quot;");
    expect(html).toContain("it&#39;s");
  });

  it("still escapes angle brackets and ampersands to prevent tag injection", () => {
    const html = renderMarkdownToHtml("<script>alert(1)</script> & Co.");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; Co.");
  });
});

describe("renderMarkdownToHtml formatting", () => {
  it("renders headings, bold, italic, and inline code", () => {
    const html = renderMarkdownToHtml("# Title\n\n**bold** and *italic* and `code`");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("returns the empty-message fallback for blank input", () => {
    expect(renderMarkdownToHtml("   ", "<p>Empty</p>")).toBe("<p>Empty</p>");
  });
});
