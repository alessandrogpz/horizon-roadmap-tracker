# Engine Dev Productivity Tracker

A sleek, premium desktop-and-mobile control panel for tracking your 12-Month Graphics & Engine Developer roadmap, daily revision habits, local project Git statistics, and study material notes.

---

## Getting Started

### Option A: Run Only on your Computer (Private)
Use this command to restrict the app access to your host PC only:
```bash
npm run dev
```
* **URL:** [http://localhost:3000](http://localhost:3000)

### Option B: Run on Both Computer & Phone (LAN Exposed)
Use this command to expose the app on your local network, enabling access from your phone or tablet on the same Wi-Fi:
```bash
npm run dev:lan
```
* **PC URL:** [http://localhost:3000](http://localhost:3000)
* **Mobile URL:** `http://<YOUR_PC_IP>:3000` (e.g. `http://192.168.0.253:3000`)

#### Firewall Configuration (UFW on Linux)
If the page hangs or fails to load on your phone under Option B, your system's firewall (`ufw`) is likely blocking port `3000`. You can open and close the port with the following commands:

* **To Open the Port (Restricted to Home Wi-Fi - Recommended):**
  ```bash
  sudo ufw allow proto tcp from 192.168.0.0/24 to any port 3000
  ```
* **To Check Active Rules (Verify):**
  ```bash
  sudo ufw status numbered
  ```
* **To Close the Port (Delete Rule when finished):**
  ```bash
  sudo ufw delete allow proto tcp from 192.168.0.0/24 to any port 3000
  ```

---

## Progressive Web App (PWA) on Mobile

When running via **Option B**, you can install the tracker as a native-feeling fullscreen application on your Android phone:
1. Open Chrome on your phone and go to your PC's network address (e.g., `http://192.168.0.253:3000`).
2. Tap the three-dot browser menu and select **Add to Home screen** or **Install app**.
3. Launch the app from your home screen to load it in standalone mode (no browser address bars, complete with a custom graphics wireframe launcher icon).

---

## Core Features

* **Roadmap Timeline:** Interactive vertical timeline with custom syllabus detailing monthly goals.
* **Consistency Streak:** GitHub-style contributions graph tracking your revisions in real-time.
* **Portfolio Tracker:** Pulls live git statistics (branch, modified counts, last commit) from your GitHub repos, or from local repository paths when running on your PC.
* **Materials & Notes:** Track subjects, edit study notes in a dual Write/Preview Markdown drawer with automatic saving, and query repository stats for your projects.
* **Cloud Sync:** All data lives in your browser (IndexedDB) and syncs to a hidden app folder in your own Google Drive via the header status line. Click to sync; Shift+Click to manage/disconnect the connection.

## Notes

* **Data storage:** Progress is local-first (IndexedDB via Dexie) and merged across devices day-by-day through the Google Drive backup (`database.json` + per-material markdown notes in the Drive `appDataFolder`).
* **GitHub rate limits:** git stats use the public GitHub API (60 requests/hour unauthenticated). To raise the limit, create a fine-grained personal access token (no scopes needed for public repos) and run `localStorage.setItem("github_token", "<token>")` once in the browser console.
* **Local-only endpoints:** `/api/git` (local repo stats) and `/api/open` (open files with xdg-open) only respond to requests addressed to `localhost` for safety.
* **Tests:** `npm test` runs the vitest suite covering the sync merge algorithm and date helpers.
