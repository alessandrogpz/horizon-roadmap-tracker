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
      logs.push("Merging progress and streaks...");
      const mergedWeeklyCompletions = { ...(localData.weeklyCompletions || {}) };
      const remoteCompletions = remoteData.weeklyCompletions || {};

      Object.keys(remoteCompletions).forEach((date) => {
        if (!mergedWeeklyCompletions[date]) {
          mergedWeeklyCompletions[date] = remoteCompletions[date];
        } else {
          mergedWeeklyCompletions[date] = {
            tasks: Array.from(new Set([...(mergedWeeklyCompletions[date].tasks || []), ...(remoteCompletions[date].tasks || [])])),
            revisions: Array.from(new Set([...(mergedWeeklyCompletions[date].revisions || []), ...(remoteCompletions[date].revisions || [])])),
          };
        }
      });

      const mergedStreakHistory = Array.from(new Set([
        ...(localData.streakHistory || []),
        ...(remoteData.streakHistory || []),
      ]));

      const mergedCompletedItemsHistory = { ...(localData.completedItemsHistory || {}) };
      const remoteCompletedItems = remoteData.completedItemsHistory || {};
      Object.keys(remoteCompletedItems).forEach((date) => {
        const localItems = mergedCompletedItemsHistory[date] || [];
        const remoteItems = remoteCompletedItems[date] || [];
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
      });

      const localReset = localData.lastTasksResetDate || "";
      const remoteReset = remoteData.lastTasksResetDate || "";

      let finalData = {
        ...localData,
        weeklyCompletions: mergedWeeklyCompletions,
        streakHistory: mergedStreakHistory,
        completedItemsHistory: mergedCompletedItemsHistory,
      };

      if (remoteReset > localReset) {
        logs.push("Remote timeline has newer checklist reset. Adopting remote daily structure.");
        finalData = {
          ...finalData,
          dailyTasks: remoteData.dailyTasks,
          dailyRevisionItems: remoteData.dailyRevisionItems,
          lastTasksResetDate: remoteReset,
          currentPhase: remoteData.currentPhase || localData.currentPhase,
          materials: remoteData.materials || localData.materials,
          portfolio: remoteData.portfolio || localData.portfolio,
        };
      }

      await db.appState.put({ id: "current", data: finalData });
      logs.push("Local database successfully updated with merged state.");
      localRecord.data = finalData;
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
