import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * The point of this is `connect-src`. The browser holds a Google Drive access
 * token, an optional GitHub token and all of the user's data, and "we don't
 * send it anywhere" is worth nothing as a promise — the operator controls the
 * code the browser runs. A CSP is different: the *browser* enforces it, the
 * header is visible in devtools in ten seconds, and no script on the page —
 * ours, a dependency's, or one injected through a hole we haven't found — can
 * open a connection to an origin that isn't listed here.
 *
 * Every origin below is one the app already talks to. Adding one is deliberate
 * friction: the allowlist is the guarantee, so widening it should be a visible
 * decision.
 */
const CONNECT_SRC = [
  "'self'",
  // Google Drive sync, Drive authorization and sign-in with Google.
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
  // Google's sign-in button loads its stylesheet from here.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  // data: for inline icons, blob: for generated backup downloads. No remote
  // hosts: the app shows no external images, and an open img-src would let
  // injected script smuggle data out in an image URL, around connect-src.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Google Identity renders its consent flow and the sign-in button in iframes.
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
