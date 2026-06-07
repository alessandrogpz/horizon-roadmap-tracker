import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const reflectionsDir = path.join(process.cwd(), 'data', 'reflections');
const logFilePath = path.join(process.cwd(), 'data', 'history.log');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');

    if (!week) {
      return NextResponse.json({ error: 'Missing week parameter' }, { status: 400 });
    }

    const filePath = path.join(reflectionsDir, `week_${week}.md`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ content: '' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    // Strip the prepended header # Week X Reflection (YYYY-MM-DD)\n\n if present
    const cleanContent = content.replace(/^# Week \d+ Reflection \([\d-]+\)\r?\n\r?\n/, '');
    return NextResponse.json({ content: cleanContent });
  } catch (error) {
    console.error('Error reading reflection file:', error);
    return NextResponse.json({ error: 'Failed to read reflection' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { week, date, content } = body;

    if (week === undefined || !date || content === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!fs.existsSync(reflectionsDir)) {
      fs.mkdirSync(reflectionsDir, { recursive: true });
    }

    const filePath = path.join(reflectionsDir, `week_${week}.md`);
    const header = `# Week ${week} Reflection (${date})\n\n`;

    fs.writeFileSync(filePath, header + content, 'utf8');

    // Log to history.log
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] REFLECTION_SAVED: Week ${week}\n`, 'utf8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing reflection file:', error);
    return NextResponse.json({ error: 'Failed to save reflection' }, { status: 500 });
  }
}
