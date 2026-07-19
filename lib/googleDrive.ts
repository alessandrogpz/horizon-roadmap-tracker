import { db } from "./localDb";

let CLIENT_ID = "";
let ACCESS_TOKEN = "";

export const setGoogleClientId = (id: string) => {
  CLIENT_ID = id;
  if (typeof window !== "undefined") {
    localStorage.setItem("google_drive_client_id", id);
  }
};

export const getGoogleClientId = () => {
  if (CLIENT_ID) return CLIENT_ID;
  if (typeof window !== "undefined") {
    return localStorage.getItem("google_drive_client_id") || "";
  }
  return "";
};

export const setGoogleAccessToken = (token: string) => {
  ACCESS_TOKEN = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("google_drive_access_token", token);
    localStorage.setItem("google_drive_token_expiry", String(Date.now() + 3500 * 1000));
  }
};

export const getGoogleAccessToken = () => {
  if (typeof window !== "undefined") {
    const expiry = Number(localStorage.getItem("google_drive_token_expiry") || "0");
    if (Date.now() < expiry) {
      return localStorage.getItem("google_drive_access_token") || "";
    }
  }
  return "";
};

export const isGoogleAuthenticated = () => {
  return !!getGoogleAccessToken();
};

export const loadGoogleGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).google?.accounts?.oauth2) return resolve();

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google GIS script"));
    document.head.appendChild(script);
  });
};

export const authenticateGoogleDrive = async (clientId: string): Promise<string> => {
  setGoogleClientId(clientId);

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !(window as any).google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services script not loaded. Please wait a moment and try again."));
      return;
    }
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file",
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || "Authentication failed"));
        } else {
          setGoogleAccessToken(response.access_token);
          resolve(response.access_token);
        }
      },
    });
    client.requestAccessToken();
  });
};

interface SyncResult {
  success: boolean;
  log: string[];
  error?: string;
}

export const syncWithGoogleDrive = async (): Promise<SyncResult> => {
  const token = getGoogleAccessToken();
  const logs: string[] = [];

  if (!token) {
    return { success: false, log: ["Not authenticated with Google Drive."], error: "Auth required" };
  }

  logs.push("Sync started: Connecting to Google Drive...");

  try {
    const localRecord = await db.appState.get("current");
    if (!localRecord) {
      return { success: false, log: logs, error: "No local data to sync" };
    }
    const localData = localRecord.data;

    let remoteFileId = "";
    let remoteData: any = null;

    const q = "name='database.json' and trashed=false";
    const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(q)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!searchRes.ok) {
      throw new Error(`Failed to search Google Drive: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      remoteFileId = searchData.files[0].id;
      logs.push("Found existing remote backup file.");

      const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${remoteFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (contentRes.ok) {
        remoteData = await contentRes.json();
        logs.push("Fetched remote backup data.");
      }
    } else {
      logs.push("No remote backup found. Creating a new one...");
    }

    if (remoteData) {
      if (!localData.isSynced) {
        logs.push("Local database is unsynced. Overwriting completely with remote backup data.");
        const finalData = { ...remoteData, isSynced: true };
        await db.appState.put({ id: "current", data: finalData });
        logs.push("Local database initialized with remote backup.");
        localRecord.data = finalData;
      } else {
        logs.push("Merging progress and streaks using day-level timestamps...");
        const mergedWeeklyCompletions = { ...(localData.weeklyCompletions || {}) };
        const mergedCompletedItemsHistory = { ...(localData.completedItemsHistory || {}) };
        
        const localUpdated = localData.lastUpdatedDates || {};
        const remoteUpdated = remoteData.lastUpdatedDates || {};
        const mergedUpdated = { ...localUpdated, ...remoteUpdated };

        const allDates = Array.from(new Set([
          ...Object.keys(localUpdated),
          ...Object.keys(remoteUpdated),
          ...Object.keys(localData.weeklyCompletions || {}),
          ...Object.keys(remoteData.weeklyCompletions || {}),
          ...Object.keys(localData.completedItemsHistory || {}),
          ...Object.keys(remoteData.completedItemsHistory || {})
        ]));

        allDates.forEach((date) => {
          const localTime = localUpdated[date] || 0;
          const remoteTime = remoteUpdated[date] || 0;

          if (remoteTime > localTime) {
            // Remote is newer: adopt remote completions and achievements for this day
            if (remoteData.weeklyCompletions?.[date]) {
              mergedWeeklyCompletions[date] = remoteData.weeklyCompletions[date];
            } else {
              delete mergedWeeklyCompletions[date];
            }

            if (remoteData.completedItemsHistory?.[date]) {
              mergedCompletedItemsHistory[date] = remoteData.completedItemsHistory[date];
            } else {
              delete mergedCompletedItemsHistory[date];
            }
          } else if (localTime > remoteTime) {
            // Local is newer: keep local completions (already in mergedWeeklyCompletions / mergedCompletedItemsHistory)
          } else {
            // Equal versions: deletion wins over addition
            const remoteTaskCount = (remoteData.weeklyCompletions?.[date]?.tasks || []).length;
            const localTaskCount = (mergedWeeklyCompletions[date]?.tasks || []).length;
            const remoteRevCount = (remoteData.weeklyCompletions?.[date]?.revisions || []).length;
            const localRevCount = (mergedWeeklyCompletions[date]?.revisions || []).length;
            
            if (remoteTaskCount < localTaskCount || remoteRevCount < localRevCount) {
              // Remote deleted something, adopt remote
              mergedWeeklyCompletions[date] = remoteData.weeklyCompletions?.[date] || { tasks: [], revisions: [] };
              mergedCompletedItemsHistory[date] = remoteData.completedItemsHistory?.[date] || [];
            } else {
              // Standard union merge for additions
              const remoteComps = remoteData.weeklyCompletions?.[date] || { tasks: [], revisions: [] };
              const localComps = mergedWeeklyCompletions[date] || { tasks: [], revisions: [] };
              mergedWeeklyCompletions[date] = {
                tasks: Array.from(new Set([...(localComps.tasks || []), ...(remoteComps.tasks || [])])),
                revisions: Array.from(new Set([...(localComps.revisions || []), ...(remoteComps.revisions || [])])),
              };

              const localItems = mergedCompletedItemsHistory[date] || [];
              const remoteItems = remoteData.completedItemsHistory?.[date] || [];
              const mergedItems = [...localItems];
              remoteItems.forEach((rIt: any) => {
                const rTitle = typeof rIt === "string" ? rIt : rIt.title;
                const exists = mergedItems.some((lIt: any) => {
                  const lTitle = typeof lIt === "string" ? lIt : lIt.title;
                  return lTitle === rTitle;
                });
                if (!exists) mergedItems.push(rIt);
              });
              mergedCompletedItemsHistory[date] = mergedItems;
            }
          }
        });

        // Rebuild streakHistory from completedItemsHistory (days that have > 0 completions)
        const mergedStreakHistory = Object.keys(mergedCompletedItemsHistory).filter(
          (date) => mergedCompletedItemsHistory[date] && mergedCompletedItemsHistory[date].length > 0
        );

        const localConfigVer = localData.configVersion || 0;
        const remoteConfigVer = remoteData.configVersion || 0;

        // Per-material merge: always prefer a real URL (http/https) over a local path
        // This ensures link edits on any device win regardless of inflated configVersion
        const isUrl = (s: string) => typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"));
        const mergeMaterials = (localMats: any[] = [], remoteMats: any[] = []) => {
          const byId = new Map<string, any>();
          localMats.forEach(m => byId.set(m.id, { ...m }));
          remoteMats.forEach(rm => {
            const lm = byId.get(rm.id);
            if (!lm) {
              byId.set(rm.id, { ...rm });
            } else {
              // Prefer real URL over local path for link field
              const preferRemoteLink = isUrl(rm.link) && !isUrl(lm.link);
              const preferLocalLink  = isUrl(lm.link)  && !isUrl(rm.link);
              byId.set(rm.id, {
                ...lm,
                // Adopt all remote scalar fields unless local clearly has a better link
                title: rm.title || lm.title,
                category: rm.category || lm.category,
                type: rm.type || lm.type,
                status: rm.status || lm.status,
                totalPages: rm.totalPages || lm.totalPages,
                currentPage: rm.currentPage ?? lm.currentPage,
                currentSubject: rm.currentSubject || lm.currentSubject,
                link: preferLocalLink ? lm.link : (preferRemoteLink ? rm.link : (rm.link || lm.link)),
                localPath: rm.localPath || lm.localPath,
              });
            }
          });
          return Array.from(byId.values());
        };

        // For portfolio, prefer whichever device has a repo URL
        const mergePortfolio = (localPort: any[] = [], remotePort: any[] = []) => {
          const byId = new Map<string, any>();
          localPort.forEach(p => byId.set(p.id, { ...p }));
          remotePort.forEach(rp => {
            const lp = byId.get(rp.id);
            if (!lp) {
              byId.set(rp.id, { ...rp });
            } else {
              const preferRemoteRepo = isUrl(rp.repoUrl) && !isUrl(lp.repoUrl);
              byId.set(rp.id, {
                ...lp,
                ...rp,
                repoUrl: preferRemoteRepo ? rp.repoUrl : (lp.repoUrl || rp.repoUrl),
              });
            }
          });
          return Array.from(byId.values());
        };

        // For structural config (phase info, startDate, weekSchedule etc) pick the higher configVersion side
        const configBase = remoteConfigVer > localConfigVer ? remoteData : localData;

        const mergedMaterials  = mergeMaterials(localData.materials,  remoteData.materials);
        const mergedPortfolio  = mergePortfolio(localData.portfolio,  remoteData.portfolio);

        let finalData = {
          ...configBase,
          // Always use smart-merged materials & portfolio
          materials: mergedMaterials,
          portfolio: mergedPortfolio,
          // Always use merged progress data
          weeklyCompletions: mergedWeeklyCompletions,
          streakHistory: mergedStreakHistory,
          completedItemsHistory: mergedCompletedItemsHistory,
          lastUpdatedDates: mergedUpdated,
          hasUnsyncedChanges: false,
          lastSyncTime: Date.now(),
          isSynced: true,
          // Normalise configVersion so both sides start from same baseline after sync
          configVersion: Math.max(localConfigVer, remoteConfigVer),
        };

        if (remoteConfigVer > localConfigVer) {
          logs.push("Remote configuration is newer. Adopting remote structural config.");
        } else if (localConfigVer > remoteConfigVer) {
          logs.push("Local configuration is newer. Keeping local structural config.");
        } else {
          // If versions are equal, fallback to reset date logic for daily structure
          const localReset = localData.lastTasksResetDate || "";
          const remoteReset = remoteData.lastTasksResetDate || "";
          if (remoteReset > localReset) {
            logs.push("Remote timeline has newer checklist reset. Adopting remote daily structure.");
            finalData = {
              ...finalData,
              dailyTasks: remoteData.dailyTasks,
              dailyRevisionItems: remoteData.dailyRevisionItems,
              lastTasksResetDate: remoteReset,
            };
          }
        }

        await db.appState.put({ id: "current", data: finalData });
        logs.push("Local database successfully updated with merged state.");
        localRecord.data = finalData;
      }
    } else {
      localRecord.data.isSynced = true;
      localRecord.data.hasUnsyncedChanges = false;
      localRecord.data.lastSyncTime = Date.now();
      await db.appState.put({ id: "current", data: localRecord.data });
    }

    const stringifiedData = JSON.stringify(localRecord.data, null, 2);

    if (remoteFileId) {
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${remoteFileId}?uploadType=media`;
      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: stringifiedData,
      });
      if (!updateRes.ok) throw new Error("Failed to upload changes to Google Drive");
      logs.push("Google Drive backup updated successfully.");
    } else {
      const metadata = {
        name: "database.json",
        parents: ["appDataFolder"],
      };

      const boundary = "foo_bar_boundary";
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        stringifiedData +
        closeDelimiter;

      const createRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });
      if (!createRes.ok) throw new Error("Failed to create Google Drive backup");
      logs.push("Google Drive backup created successfully.");
    }

    logs.push("Syncing study notes...");
    await syncNotesWithGoogleDrive(token, logs);

    logs.push("Sync completed successfully ✓");
    return { success: true, log: logs };
  } catch (err: any) {
    console.error("Google Drive sync failed:", err);
    logs.push(`Sync failed ✕: ${err.message || err}`);
    return { success: false, log: logs, error: err.message || err };
  }
};

const syncNotesWithGoogleDrive = async (token: string, logs: string[]): Promise<void> => {
  const localNotes = await db.notes.toArray();

  const q = "mimeType='text/markdown' and trashed=false";
  const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(q)}`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!searchRes.ok) return;
  const searchData = await searchRes.json();
  const remoteNotes = searchData.files || [];

  for (const localNote of localNotes) {
    const fileName = `note_${localNote.id}.md`;
    const remoteFile = remoteNotes.find((f: any) => f.name === fileName);

    if (remoteFile) {
      const fileId = remoteFile.id;
      const fileMetaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (fileMetaRes.ok) {
        const fileMeta = await fileMetaRes.json();
        const remoteModifiedTime = new Date(fileMeta.modifiedTime).getTime();

        if (localNote.updatedAt > remoteModifiedTime) {
          await uploadNoteFile(token, fileId, fileName, localNote.content);
        } else if (remoteModifiedTime > localNote.updatedAt) {
          const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (downloadRes.ok) {
            const remoteContent = await downloadRes.text();
            await db.notes.put({ id: localNote.id, content: remoteContent, updatedAt: remoteModifiedTime });
          }
        }
      }
    } else {
      await createNoteFile(token, fileName, localNote.content);
    }
  }

  for (const remoteFile of remoteNotes) {
    if (remoteFile.name.startsWith("note_") && remoteFile.name.endsWith(".md")) {
      const noteId = remoteFile.name.replace("note_", "").replace(".md", "");
      const existsLocally = localNotes.some((n) => n.id === noteId);
      if (!existsLocally) {
        const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${remoteFile.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (downloadRes.ok) {
          const remoteContent = await downloadRes.text();
          const fileMetaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${remoteFile.id}?fields=modifiedTime`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const modifiedTimeStr = fileMetaRes.ok ? (await fileMetaRes.json()).modifiedTime : null;
          const updatedAt = modifiedTimeStr ? new Date(modifiedTimeStr).getTime() : Date.now();
          await db.notes.put({ id: noteId, content: remoteContent, updatedAt });
        }
      }
    }
  }
};

const uploadNoteFile = async (token: string, fileId: string, fileName: string, content: string): Promise<void> => {
  const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/markdown",
    },
    body: content,
  });
};

const createNoteFile = async (token: string, fileName: string, content: string): Promise<void> => {
  const metadata = {
    name: fileName,
    parents: ["appDataFolder"],
    mimeType: "text/markdown",
  };

  const boundary = "note_boundary";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: text/markdown\r\n\r\n" +
    content +
    closeDelimiter;

  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
};
