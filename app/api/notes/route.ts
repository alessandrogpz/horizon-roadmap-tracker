import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Read-only migration fallback: serves the markdown notes that older versions
// of the app stored in the repo, so a fresh browser can import them into
// IndexedDB. All saving happens client-side (IndexedDB + Google Drive).
const NOTES_DIR = path.join(process.cwd(), "data", "notes");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Material ID is required" }, { status: 400 });
  }

  // Safety check: sanitize ID to prevent directory traversal
  const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(NOTES_DIR, `${sanitizedId}.md`);

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ content: "" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
