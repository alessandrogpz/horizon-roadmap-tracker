import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const roadmapPath = path.join(process.cwd(), "engine_dev_roadmap.md");
  try {
    const content = fs.readFileSync(roadmapPath, "utf8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: "Roadmap file not found at project root." }, { status: 404 });
  }
}
