# Engine Dev Productivity Tracker

A sleek, premium desktop-and-mobile control panel for tracking your 12-Month Graphics & Engine Developer roadmap, daily revision habits, local project Git statistics, and study material notes.

---

## 🛠️ Tech Stack & Architecture

The project has been refactored into a modular, type-safe Next.js PWA:

*   **Framework:** Next.js (with Turbopack) & React 19
*   **Styling:** Tailwind CSS v4 & PostCSS (using CSS-native `@import` and custom theme extensions)
*   **Database (Local-first):** Dexie.js (IndexedDB wrapper) for offline persistence
*   **Storage & Sync:** Google Drive API (sandboxed `appDataFolder` scope) with a custom, day-level logical-version conflict resolution engine.
*   **Tests:** Vitest for testing date-helpers and state merge algorithms.

### 📂 Directory Structure

```
├── app/                     # Next.js Pages & Styles
│   ├── globals.css          # Tailwind CSS v4 & Custom styles
│   ├── layout.tsx           # Global HTML wrapper (with JetBrains Mono font)
│   ├── page.tsx             # Main dashboard view
│   └── manifest.ts          # PWA Manifest configuration
├── components/              # Modular UI Components
│   ├── DashboardHeader.tsx  # Top status line & Sync controls
│   ├── WeeklyPlan.tsx       # 7-day study planner
│   ├── MaterialsTracker.tsx # Syllabus reference materials & Notes
│   ├── PortfolioTracker.tsx # Repository checklist & live Git stats
│   ├── PhaseTracker.tsx     # Roadmap phases list
│   └── PomodoroTimer.tsx    # Focus timer component
├── lib/                     # Decoupled logic libraries
│   ├── api.ts               # Local DB operations & Git fetching
│   ├── googleDrive.ts       # Google Drive token & upload wrapper
│   ├── merge.ts             # Sync state merger (checkboxes & materials)
│   ├── streak.ts            # Streak calculation helpers
│   ├── dates.ts             # Date and week utility functions
│   └── types.ts             # TypeScript interfaces
├── public/                  # Static assets & Service Worker
│   ├── sw.js                # Custom offline service worker
│   └── icon.jpg             # PWA Torus Icon (glossy rainbow on flat black)
```

---

## 🚀 Getting Started

### Option A: Run Only on your Computer (Private)
Use this command to restrict the app access to your host PC only:
```bash
npm run dev
```
*   **URL:** [http://localhost:3000](http://localhost:3000)

### Option B: Run on Both Computer & Phone (LAN Exposed)
Use this command to expose the app on your local network, enabling access from your phone or tablet on the same Wi-Fi:
```bash
npm run dev:lan
```
*   **PC URL:** [http://localhost:3000](http://localhost:3000)
*   **Mobile URL:** `http://<YOUR_PC_IP>:3000` (e.g. `http://192.168.0.253:3000`)

#### Firewall Configuration (UFW on Linux)
If the page hangs or fails to load on your phone under Option B, your system's firewall (`ufw`) is likely blocking port `3000`. You can open and close the port with the following commands:

*   **To Open the Port (Restricted to Home Wi-Fi - Recommended):**
    ```bash
    sudo ufw allow proto tcp from 192.168.0.0/24 to any port 3000
    ```
*   **To Check Active Rules (Verify):**
    ```bash
    sudo ufw status numbered
    ```
*   **To Close the Port (Delete Rule when finished):**
    ```bash
    sudo ufw delete allow proto tcp from 192.168.0.0/24 to any port 3000
    ```

---

## 📱 Progressive Web App (PWA) on Mobile

When running via **Option B**, you can install the tracker as a native standalone application on your Android/iOS phone:
1. Open Chrome/Safari on your phone and go to your PC's network address (e.g., `http://192.168.0.253:3000`).
2. Tap the browser menu and select **Add to Home screen** or **Install app**.
3. Launch the app from your home screen. It will load in full-screen standalone mode (no browser address bars, complete with a custom glossy graphics torus launcher icon).

---

## 💡 Core Features & Mechanics

*   **Roadmap Timeline:** Interactive vertical timeline detailing the monthly phases and specific syllabi.
*   **Consistency Streak:** GitHub-style contributions graph (rounded squares) tracking your revisions in real-time.
*   **Portfolio Tracker:** Displays repository checklists and pulls live git statistics (branch, modified status, last commit message) from local git repos or GitHub.
*   **Materials & Notes:** Track references, edit study notes in a Markdown editor with a live Preview pane, and query repo statistics.
*   **Cloud Sync:** All data lives in your browser (IndexedDB) and syncs bidirectionally to a hidden app folder in your own Google Drive. 
    *   *Click to sync; Shift+Click to manage/disconnect the connection.*

---

## 🔒 Notes & Security

*   **Universal Change Tracking:** Sync comparison logic monitors all data arrays (materials, portfolio, configurations). Changes to any item trigger an auto-save and raise `configVersion` for the next sync.
*   **Git Stats Caching:** GitHub API calls are subject to a 60 requests/hour unauthenticated limit. The app mitigates this by:
    *   Caching results in browser `localStorage` for **15 minutes**.
    *   Falling back to the expired cache if a `403 (Rate Limited)` response is returned, guaranteeing the stats always show in the UI.
*   **Local-only Endpoints:** `/api/git` (local filesystem repo status) and `/api/open` (opening PDF/source links locally) only accept requests addressed to `localhost` to protect your filesystem when exposed on a LAN.
*   **Automated Tests:** Run `npm test` to execute the Vitest test suite verifying the date handlers and the conflict resolution merge logic.
