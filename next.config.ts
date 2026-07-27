import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * The point of this is `connect-src`. Horizon asks users to paste an API key
 * for their own AI provider, and "we don't send your key anywhere" is worth
 * nothing as a promise — the operator controls the code the browser runs. A CSP
 * is different: the *browser* enforces it, the header is visible in devtools in
 * ten seconds, and no script on the page — ours, a dependency's, or one injected
 * through a hole we haven't found — can open a connection to an origin that
 * isn't listed here.
 *
 * Every origin below is one the app already talks to. Adding a provider means
 * adding its origin here too, and that is deliberate friction: the allowlist is
 * the guarantee, so widening it should be a visible decision.
 */
const CONNECT_SRC = [
  "'self'",
  // AI providers — the only destinations an API key is ever sent to.
  "https://generativelanguage.googleapis.com", // Gemini
  "https://openrouter.ai", // OpenRouter
  // Google Drive sync and its auth.
  "https://www.googleapis.com",
  "https://accounts.google.com",
  // Repo stats shown on materials and portfolio entries.
  "https://api.github.com",
];

const CSP = [
  "default-src 'self'",
  `connect-src ${CONNECT_SRC.join(" ")}`,
  // 'unsafe-inline' is required by Next's runtime and by the pre-paint theme
  // script in app/layout.tsx, which has to run before first paint to avoid a
  // flash. It weakens XSS defence, which is why the markdown renderer escapes
  // all input and allowlists URL schemes rather than leaning on CSP for it.
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  // data: for inline icons, blob: for generated backup downloads.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Google Identity renders its consent flow in an iframe.
  "frame-src https://accounts.google.com",
  // Nothing here should ever post a form anywhere, or be framed by anyone.
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.253", "192.168.0.253:3000"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Belt and braces around the same concern: don't leak the page URL to
          // third parties, and don't let the browser guess content types.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
