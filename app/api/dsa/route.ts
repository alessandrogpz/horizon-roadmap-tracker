import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const dsaPath = path.join(process.cwd(), "DSA_Study_Guide.md");
  try {
    const content = fs.readFileSync(dsaPath, "utf8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ content: "DSA_Study_Guide.md not found at project root." }, { status: 404 });
  }
}
