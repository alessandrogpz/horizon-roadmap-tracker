# Horizon: Roadmap Tracker

A sleek, premium desktop-and-mobile control panel for tracking custom learning roadmaps, daily revision habits, local project Git statistics, and study notes.

*Note: The current active roadmap in this workspace is configured for the 12-Month Graphics & Game Engine Developer track.*

---

## Tech Stack & Architecture

The project has been refactored into a modular, type-safe Next.js PWA:

*   **Framework:** Next.js (with Turbopack) & React 19
*   **Styling:** Tailwind CSS v4 & PostCSS (using CSS-native `@import` and custom theme extensions)
*   **Database (Local-first):** Dexie.js (IndexedDB wrapper) for offline persistence
*   **Storage & Sync:** Google Drive API (sandboxed `appDataFolder` scope) with a custom, day-level logical-version conflict resolution engine.
*   **Tests:** Vitest for testing date-helpers and state merge algorithms.

### Directory Structure

The app is layered: `lib/` holds the data model and every rule about what an
edit *means*, and knows nothing about React; `components/` renders it and owns
no business logic.

```
├── app/                          # Next.js routes & styles
│   ├── globals.css               # Tailwind CSS v4 & custom styles
│   ├── layout.tsx                # Global HTML wrapper (with JetBrains Mono font)
│   ├── page.tsx                  # Mounts the workspace provider + dashboard
│   ├── roadmap/page.tsx          # Per-track markdown roadmap editor
│   └── manifest.ts               # PWA manifest configuration
├── components/
│   ├── Dashboard.tsx             # Layout, drag-and-drop, modal orchestration
│   ├── workspace/                # WorkspaceProvider — app state & persistence
│   ├── panels/                   # Panel registry, panel wiring, error boundary
│   ├── DashboardHeader.tsx       # Top status line & sync controls
│   ├── WeeklyPlan.tsx            # 7-day study planner
│   ├── MaterialsTracker.tsx      # Syllabus reference materials & notes
│   ├── PortfolioTracker.tsx      # Repository checklist & live git stats
│   ├── PhaseTracker.tsx          # Roadmap phases list
│   └── PomodoroTimer.tsx         # Focus timer component
├── lib/                          # Framework-free logic
│   ├── workspaceRepo.ts          # The only reader/writer of the stored workspace
│   ├── localDb.ts                # Dexie schema
│   ├── migrations/               # Versioned, append-only shape upgrades
│   ├── trackActions.ts           # Pure track mutations (materials, phases, ...)
│   ├── completions.ts            # Pure checkbox/streak rules
│   ├── selectors.ts              # Pure workspace queries
│   ├── merge.ts                  # Sync state merger (checkboxes & materials)
│   ├── googleDrive.ts            # Drive auth, REST client & sync engine
│   ├── gitStats.ts               # GitHub / local git stats, with caching
│   ├── modules.ts                # Which dashboard modules exist
│   ├── streak.ts                 # Streak calculation helpers
│   ├── dates.ts                  # Date and week utility functions
│   └── types.ts                  # TypeScript interfaces
├── public/                       # Static assets & service worker
│   ├── sw.js                     # Custom offline service worker
│   └── icon-*.png                # PWA icons, rendered from app/icon.svg
├── brand/                        # Logo sources & the script that renders them
│   └── build-icons.sh            # Regenerates every PNG/ICO from the SVGs
```

### The logo

`app/icon.svg` is the master: a sun clearing the horizon, where the horizon
line doubles as the track's progress bar. Everything else is derived from it —
`public/icon-192.png`, `public/icon-512.png`, `app/apple-icon.png` and
`app/favicon.ico`, plus two full-bleed variants in `brand/` for Android's
maskable crop and iOS's squircle mask. After editing any SVG, re-render with:

```bash
./brand/build-icons.sh    # needs rsvg-convert (librsvg) and magick (ImageMagick 7)
```

Inside the app the same mark is drawn plate-free in `currentColor` by
`components/HorizonMark.tsx`, so it picks up the theme.

---

## Getting Started

### Local Development
To run only on your local computer:
```bash
npm run dev
```
*   **URL:** [http://localhost:3000](http://localhost:3000)

---

## Progressive Web App (PWA) on Mobile

You can install the tracker as a native standalone application on your Android/iOS phone:
1. Open your live Vercel URL on your phone's browser (e.g., Chrome or Safari).
2. Tap the browser menu and select **Add to Home screen** or **Install app**.
3. Launch the app from your home screen. It will load in full-screen standalone mode (no browser address bars, complete with your custom glossy graphics torus launcher icon).

---

## Core Features & Mechanics

*   **Roadmap Timeline:** Interactive vertical timeline detailing the monthly phases and specific syllabi.
*   **Consistency Streak:** GitHub-style contributions graph (rounded squares) tracking your revisions in real-time.
*   **Portfolio Tracker:** Displays repository checklists and pulls live git statistics (branch, modified status, last commit message) from local git repos or GitHub.
*   **Materials & Notes:** Track references, edit study notes in a Markdown editor with a live Preview pane, and query repo statistics.
*   **Cloud Sync:** All data lives in your browser (IndexedDB) and syncs bidirectionally to a hidden app folder in your own Google Drive. 
    *   *Click to sync; Shift+Click to manage/disconnect the connection.*

---

## Notes & Security

*   **Universal Change Tracking:** Sync comparison logic monitors all data arrays (materials, portfolio, configurations). Changes to any item trigger an auto-save and raise `configVersion` for the next sync.
*   **Git Stats Caching:** GitHub API calls are subject to a 60 requests/hour unauthenticated limit, **per IP**, and each repo costs two requests (metadata + last commit). The app stays inside that budget by:
    *   Caching results in browser `localStorage` for **1 hour**.
    *   Fetching only when the set of linked repos actually changes — not on every workspace edit.
    *   Sharing one in-flight request per repo, since Materials and Portfolio often link the same one.
    *   Pausing all requests until GitHub's own reset time after a `403`, and falling back to the expired cache so the stats still show in the UI.
    *   To lift the ceiling to 5000/hour, set a read-only personal access token once from the browser console:
        ```js
        localStorage.setItem("github_token", "<token>")
        ```
*   **Local-only Endpoints:** `/api/git` (local filesystem repo status), `/api/open` (opening PDF/source links locally) and `/api/notes` (one-time import of notes from an older on-disk format) only accept requests addressed to `localhost` and sent by the app's own pages — not from other devices when the dev server is exposed on a LAN, and not from other websites open in your browser (see `lib/server/localRequest.ts`).
*   **Automated Tests:** Run `npm test` to execute the Vitest test suite verifying the date handlers and the conflict resolution merge logic.
