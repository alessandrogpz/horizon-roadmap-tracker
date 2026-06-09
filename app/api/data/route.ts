import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const dataFilePath = path.join(process.cwd(), 'data', 'database.json');
const logFilePath = path.join(process.cwd(), 'data', 'history.log');

export async function GET() {
  try {
    const fileContents = fs.readFileSync(dataFilePath, 'utf8');
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isReset = body.isReset === true;
    delete body.isReset;

    // Read old state for diffing
    let oldData: any = {};
    try {
      if (fs.existsSync(dataFilePath)) {
        const fileContents = fs.readFileSync(dataFilePath, 'utf8');
        oldData = JSON.parse(fileContents);
      }
    } catch (e) {
      console.error('Failed to parse old data for diffing:', e);
    }

    const logs: string[] = [];
    const timestamp = new Date().toISOString();

    if (isReset) {
      logs.push(`[${timestamp}] DAILY_TASKS_RESET`);
    } else {
      // 1. Diff daily routine check
      if (oldData.lastDailyRoutineCheck !== body.lastDailyRoutineCheck) {
        const action = body.lastDailyRoutineCheck ? "COMPLETED" : "UNCOMPLETED";
        logs.push(`[${timestamp}] ROUTINE_${action}`);
      }

      // 2. Diff current phase change
      if (oldData.currentPhase !== body.currentPhase && oldData.currentPhase !== undefined) {
        logs.push(`[${timestamp}] PHASE_CHANGED: Phase ${oldData.currentPhase} -> Phase ${body.currentPhase}`);
      }

      // 3. Diff tasks
      if (oldData.phases && body.phases) {
        body.phases.forEach((newPhase: any, pIdx: number) => {
          const oldPhase = oldData.phases.find((p: any) => p.id === newPhase.id);
          if (oldPhase && oldPhase.tasks && newPhase.tasks) {
            newPhase.tasks.forEach((newTask: any) => {
              const oldTask = oldPhase.tasks.find((t: any) => t.id === newTask.id);
              if (oldTask && oldTask.completed !== newTask.completed) {
                const action = newTask.completed ? "COMPLETED" : "UNCOMPLETED";
                logs.push(`[${timestamp}] TASK_${action}: "${newTask.title}" (Phase ${newPhase.id})`);
              }
            });
          }
        });
      }

      // Diff daily tasks
      if (oldData.dailyTasks && body.dailyTasks) {
        Object.keys(body.dailyTasks).forEach((dayKey) => {
          const oldDayTasks = oldData.dailyTasks[dayKey] || [];
          const newDayTasks = body.dailyTasks[dayKey] || [];
          
          newDayTasks.forEach((newTask: any) => {
            const oldTask = oldDayTasks.find((t: any) => t.id === newTask.id);
            if (oldTask && oldTask.completed !== newTask.completed) {
              const action = newTask.completed ? "COMPLETED" : "UNCOMPLETED";
              logs.push(`[${timestamp}] DAILY_TASK_${action}: "${newTask.title}" (${dayKey})`);
            }
          });
        });
      }

      // Diff daily revision items
      if (oldData.dailyRevisionItems && body.dailyRevisionItems) {
        Object.keys(body.dailyRevisionItems).forEach((dayKey) => {
          const oldDayItems = oldData.dailyRevisionItems[dayKey] || [];
          const newDayItems = body.dailyRevisionItems[dayKey] || [];
          
          newDayItems.forEach((newItem: any) => {
            const oldItem = oldDayItems.find((it: any) => it.id === newItem.id);
            if (oldItem && oldItem.completed !== newItem.completed) {
              const action = newItem.completed ? "COMPLETED" : "UNCOMPLETED";
              logs.push(`[${timestamp}] REVISION_ITEM_${action}: "${newItem.title}" (${dayKey})`);
            }
          });
        });
      }

      // 4. Diff portfolio deliverables
      if (oldData.portfolio && body.portfolio) {
        body.portfolio.forEach((newProj: any) => {
          const oldProj = oldData.portfolio.find((p: any) => p.id === newProj.id);
          if (oldProj && oldProj.completed !== newProj.completed) {
            const action = newProj.completed ? "COMPLETED" : "UNCOMPLETED";
            logs.push(`[${timestamp}] DELIVERABLE_${action}: "${newProj.title}"`);
          }
        });
      }

      // 5. Diff materials
      if (oldData.materials && body.materials) {
        body.materials.forEach((newMat: any) => {
          const oldMat = oldData.materials.find((m: any) => m.id === newMat.id);
          if (!oldMat) {
            logs.push(`[${timestamp}] MATERIAL_ADDED: "${newMat.title}" (${newMat.category})`);
          } else {
            if (oldMat.status !== newMat.status) {
              logs.push(`[${timestamp}] MATERIAL_STATUS: "${newMat.title}" -> "${newMat.status}"`);
            }
            if (oldMat.currentPage !== newMat.currentPage || oldMat.currentSubject !== newMat.currentSubject) {
              logs.push(`[${timestamp}] MATERIAL_PROGRESS: "${newMat.title}" -> Page ${newMat.currentPage}/${newMat.totalPages || '?'}, Subject: "${newMat.currentSubject || 'None'}"`);
            }
            if (oldMat.title !== newMat.title || oldMat.category !== newMat.category || oldMat.type !== newMat.type || oldMat.totalPages !== newMat.totalPages || oldMat.link !== newMat.link) {
              logs.push(`[${timestamp}] MATERIAL_EDITED: "${newMat.title}" (${newMat.category}, ${newMat.type}, Link: "${newMat.link || 'None'}")`);
            }
          }
        });
        // Check for deleted materials
        oldData.materials.forEach((oldMat: any) => {
          const newMat = body.materials.find((m: any) => m.id === oldMat.id);
          if (!newMat) {
            logs.push(`[${timestamp}] MATERIAL_DELETED: "${oldMat.title}"`);
          }
        });
      }
    }

    // Write logs to history.log
    if (logs.length > 0) {
      fs.appendFileSync(logFilePath, logs.join('\n') + '\n', 'utf8');
    }

    // Save database.json
    fs.writeFileSync(dataFilePath, JSON.stringify(body, null, 2), 'utf8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing data file:', error);
    return NextResponse.json({ error: 'Failed to write data' }, { status: 500 });
  }
}
