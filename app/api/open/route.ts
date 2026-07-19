import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { isLocalRequest, localOnlyResponse } from '@/lib/server/localRequest';

// Resolve paths beginning with ~ to the system user's home directory
function resolveHomePath(inputPath: string): string {
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

export async function POST(request: Request) {
  if (!isLocalRequest(request)) {
    return localOnlyResponse();
  }
  try {
    const { link } = await request.json();
    if (!link) {
      return NextResponse.json({ error: 'No link provided' }, { status: 400 });
    }

    const target = resolveHomePath(link);

    // Run xdg-open to open local files, directories, or URLs in default applications
    // Using spawn is safe from shell injections as it doesn't run in a shell.
    spawn('xdg-open', [target], { detached: true, stdio: 'ignore' }).unref();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in open API:', error);
    return NextResponse.json({ error: 'Failed to open link' }, { status: 500 });
  }
}
