import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(request: Request) {
  try {
    const { link } = await request.json();
    if (!link) {
      return NextResponse.json({ error: 'No link provided' }, { status: 400 });
    }

    // Run xdg-open to open local files, directories, or URLs in default applications
    // Using spawn is safe from shell injections as it doesn't run in a shell.
    spawn('xdg-open', [link], { detached: true, stdio: 'ignore' }).unref();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in open API:', error);
    return NextResponse.json({ error: 'Failed to open link' }, { status: 500 });
  }
}
