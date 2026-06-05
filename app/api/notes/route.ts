import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const NOTES_DIR = path.join(process.cwd(), "data", "notes");

// Ensure the notes directory exists
function ensureNotesDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
}

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
    ensureNotesDir();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ content: "" });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to read notes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, content } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Material ID is required" }, { status: 400 });
    }

    // Safety check: sanitize ID to prevent directory traversal
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(NOTES_DIR, `${sanitizedId}.md`);

    ensureNotesDir();
    fs.writeFileSync(filePath, content || "", "utf-8");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save notes" }, { status: 500 });
  }
}
