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
* **Portfolio Tracker:** Integrates with local repository paths on your filesystem to pull live git statistics (branches, modified counts, last commits).
* **Materials & Notes:** Track subjects, edit study notes in a dual Write/Preview Markdown drawer with automatic saving, and query repository stats for your projects.
* **Workspace Sync:** An integrated top-right header controller to pull, stage, commit, and push your developer hub tracking data automatically to GitHub.
