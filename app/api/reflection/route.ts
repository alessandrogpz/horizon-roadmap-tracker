import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const reflectionsDir = path.join(process.cwd(), 'data', 'reflections');
const logFilePath = path.join(process.cwd(), 'data', 'history.log');

interface SectionData {
  date: string;
  content: string;
}

function parseReflectionFile(fileContent: string) {
  const sections: Record<string, SectionData> = {
    Monday: { date: '', content: '' },
    Tuesday: { date: '', content: '' },
    Wednesday: { date: '', content: '' },
    Thursday: { date: '', content: '' },
    Friday: { date: '', content: '' },
    Saturday: { date: '', content: '' },
    Weekly: { date: '', content: '' }
  };

  let mainHeaderDate = '';
  const mainHeaderMatch = fileContent.match(/^# Week \d+ Reflection \(([\d-]+)\)/);
  if (mainHeaderMatch) {
    mainHeaderDate = mainHeaderMatch[1];
  }

  const body = fileContent.replace(/^# Week \d+ Reflection \([\d-]+\)\r?\n\r?\n/, '');
  const parts = body.split(/^## /m);

  const hasSubheadings = parts.length > 1;
  if (!hasSubheadings && body.trim() !== '') {
    sections.Weekly = {
      date: mainHeaderDate,
      content: body.trim()
    };
  } else {
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const newlineIndex = part.indexOf('\n');
      const headerLine = newlineIndex !== -1 ? part.substring(0, newlineIndex).trim() : part.trim();
      const content = newlineIndex !== -1 ? part.substring(newlineIndex + 1) : '';

      const headerMatch = headerLine.match(/^([A-Za-z ]+)\s*\(([\d-]+)\)/);
      if (headerMatch) {
        let key = headerMatch[1].trim();
        const date = headerMatch[2].trim();

        if (key === 'Weekly Reflection') {
          key = 'Weekly';
        }

        if (key in sections) {
          sections[key] = {
            date,
            content: content.trim()
          };
        }
      }
    }
  }

  return { mainHeaderDate, sections };
}

function serializeReflectionFile(week: number, mainHeaderDate: string, sections: Record<string, SectionData>): string {
  let output = `# Week ${week} Reflection (${mainHeaderDate})\n\n`;

  const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Weekly'];

  for (const day of daysOrder) {
    const section = sections[day];
    if (section && (section.content.trim() !== '' || section.date !== '')) {
      const title = day === 'Weekly' ? 'Weekly Reflection' : day;
      output += `## ${title} (${section.date || mainHeaderDate})\n${section.content.trim()}\n\n`;
    }
  }

  return output;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');

    if (!week) {
      return NextResponse.json({ error: 'Missing week parameter' }, { status: 400 });
    }

    const filePath = path.join(reflectionsDir, `week_${week}.md`);
    
    const defaultDays: Record<string, string> = {
      Monday: '',
      Tuesday: '',
      Wednesday: '',
      Thursday: '',
      Friday: '',
      Saturday: ''
    };

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        content: '',
        weekly: '',
        days: defaultDays
      });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { sections } = parseReflectionFile(content);

    const days: Record<string, string> = {};
    for (const d of Object.keys(defaultDays)) {
      days[d] = sections[d]?.content || '';
    }

    return NextResponse.json({
      content: sections.Weekly?.content || '',
      weekly: sections.Weekly?.content || '',
      days
    });
  } catch (error) {
    console.error('Error reading reflection file:', error);
    return NextResponse.json({ error: 'Failed to read reflection' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { week, date, content } = body;
    const day = body.day || 'Weekly';

    if (week === undefined || !date || content === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!fs.existsSync(reflectionsDir)) {
      fs.mkdirSync(reflectionsDir, { recursive: true });
    }

    const filePath = path.join(reflectionsDir, `week_${week}.md`);
    
    // Do not create the file or record a save log if the file doesn't exist and the saved content is empty
    if (!fs.existsSync(filePath) && content.trim() === '') {
      return NextResponse.json({ success: true });
    }
    
    let mainHeaderDate = date;
    let sections: Record<string, SectionData> = {
      Monday: { date: '', content: '' },
      Tuesday: { date: '', content: '' },
      Wednesday: { date: '', content: '' },
      Thursday: { date: '', content: '' },
      Friday: { date: '', content: '' },
      Saturday: { date: '', content: '' },
      Weekly: { date: '', content: '' }
    };

    if (fs.existsSync(filePath)) {
      const existingContent = fs.readFileSync(filePath, 'utf8');
      const parsed = parseReflectionFile(existingContent);
      mainHeaderDate = parsed.mainHeaderDate || date;
      sections = parsed.sections;
    }

    // Update targeted day/Weekly section
    if (day in sections) {
      sections[day] = { date, content };
    } else if (day === 'Weekly') {
      sections.Weekly = { date, content };
    }

    // If updating weekly reflection, let's also ensure main header date reflects Sunday if not set
    if (day === 'Weekly' && !parsedMainHeaderDateExists(filePath, date)) {
      mainHeaderDate = date;
    }

    const serialized = serializeReflectionFile(week, mainHeaderDate, sections);
    fs.writeFileSync(filePath, serialized, 'utf8');

    // Log to history.log
    const timestamp = new Date().toISOString();
    const logTag = day === 'Weekly' ? `Week ${week}` : `Week ${week} - ${day}`;
    fs.appendFileSync(logFilePath, `[${timestamp}] REFLECTION_SAVED: ${logTag}\n`, 'utf8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing reflection file:', error);
    return NextResponse.json({ error: 'Failed to save reflection' }, { status: 500 });
  }
}

function parsedMainHeaderDateExists(filePath: string, defaultDate: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^# Week \d+ Reflection \(([\d-]+)\)/);
  return !!match;
}
