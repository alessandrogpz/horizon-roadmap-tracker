import { db } from "./localDb";
import type { AppState, SyncResult } from "./types";
import { mergeAppState } from "./merge";

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

export const clearGoogleAccessToken = () => {
  ACCESS_TOKEN = "";
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_drive_access_token");
    localStorage.removeItem("google_drive_token_expiry");
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
    if ((window as any).google?.accounts?.oauth2 ) return resolve();

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
      // appDataFolder is the only Drive surface this app touches
      scope: "https://www.googleapis.com/auth/drive.appdata",
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

/** Thrown when Drive rejects the access token; caller should re-authenticate and retry. */
class DriveAuthError extends Error {
  constructor() {
    super("Google Drive session expired. Please re-authenticate.");
    this.name = "DriveAuthError";
  }
}

/** fetch wrapper that detects revoked/expired tokens and clears them. */
const driveFetch = async (token: string, url: string, init?: RequestInit): Promise<Response> => {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    clearGoogleAccessToken();
    throw new DriveAuthError();
  }
  return res;
};

export const syncWithGoogleDrive = async (): Promise<SyncResult> => {
  const token = getGoogleAccessToken();
  const logs: string[] = [];

  if (!token) {
    return { success: false, log: ["Not authenticated with Google Drive."], error: "Auth required", authRequired: true };
  }

  logs.push("Sync started: Connecting to Google Drive...");

  try {
    const localRecord = await db.appState.get("current");
    if (!localRecord) {
      return { success: false, log: logs, error: "No local data to sync" };
    }
    const localData: AppState = localRecord.data;

    let remoteFileId = "";
    let remoteData: AppState | null = null;

    const q = "name='database.json' and trashed=false";
    const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(q)}`;
    const searchRes = await driveFetch(token, searchUrl);

    if (!searchRes.ok) {
      throw new Error(`Failed to search Google Drive: ${searchRes.statusText}`);
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      remoteFileId = searchData.files[0].id;
      logs.push("Found existing remote backup file.");

      const contentRes = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${remoteFileId}?alt=media`);
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
        const { data: finalData, log: mergeLog } = mergeAppState(localData, remoteData);
        logs.push(...mergeLog);

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
      const updateRes = await driveFetch(token, updateUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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

      const createRes = await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
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
    return {
      success: false,
      log: logs,
      error: err.message || String(err),
      authRequired: err instanceof DriveAuthError,
    };
  }
};

const syncNotesWithGoogleDrive = async (token: string, logs: string[]): Promise<void> => {
  const localNotes = await db.notes.toArray();

  const q = "mimeType='text/markdown' and trashed=false";
  const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(q)}`;
  const searchRes = await driveFetch(token, searchUrl);
  if (!searchRes.ok) {
    logs.push("Note sync skipped: could not list remote notes.");
    return;
  }
  const searchData = await searchRes.json();
  const remoteNotes = searchData.files || [];

  for (const localNote of localNotes) {
    const fileName = `note_${localNote.id}.md`;
    const remoteFile = remoteNotes.find((f: any) => f.name === fileName);

    if (remoteFile) {
      const fileId = remoteFile.id;
      const fileMetaRes = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`);

      if (fileMetaRes.ok) {
        const fileMeta = await fileMetaRes.json();
        const remoteModifiedTime = new Date(fileMeta.modifiedTime).getTime();

        if (localNote.updatedAt > remoteModifiedTime) {
          await uploadNoteFile(token, fileId, localNote.content);
        } else if (remoteModifiedTime > localNote.updatedAt) {
          const downloadRes = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
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
        const downloadRes = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${remoteFile.id}?alt=media`);
        if (downloadRes.ok) {
          const remoteContent = await downloadRes.text();
          const fileMetaRes = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${remoteFile.id}?fields=modifiedTime`);
          const modifiedTimeStr = fileMetaRes.ok ? (await fileMetaRes.json()).modifiedTime : null;
          const updatedAt = modifiedTimeStr ? new Date(modifiedTimeStr).getTime() : Date.now();
          await db.notes.put({ id: noteId, content: remoteContent, updatedAt });
        }
      }
    }
  }
};

const uploadNoteFile = async (token: string, fileId: string, content: string): Promise<void> => {
  const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  await driveFetch(token, updateUrl, {
    method: "PATCH",
    headers: { "Content-Type": "text/markdown" },
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

  await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipartBody,
  });
};
