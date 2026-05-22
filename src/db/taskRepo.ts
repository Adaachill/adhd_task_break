import { getDb } from '@/db';
import type { ShojikubaiDef, ShojikubaiTier, Task } from '@/types/task';

// DB の行表現（snake_case / 整数bool / JSON文字列）
interface TaskRow {
  id: string;
  text: string;
  type: string | null;
  due: string | null;
  is_habit: number;
  status: string;
  classify_source: string;
  shojikubai: string | null;
  completed_tier: string | null;
  timer_minutes: number | null;
  timer_started_at: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    text: r.text,
    type: (r.type as Task['type']) ?? null,
    due: (r.due as Task['due']) ?? null,
    isHabit: r.is_habit === 1,
    status: r.status as Task['status'],
    classifySource: r.classify_source as Task['classifySource'],
    shojikubai: r.shojikubai ? (JSON.parse(r.shojikubai) as ShojikubaiDef) : null,
    completedTier: (r.completed_tier as ShojikubaiTier) ?? null,
    timerMinutes: r.timer_minutes,
    timerStartedAt: r.timer_started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function insertTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO tasks
       (id, text, type, due, is_habit, status, classify_source,
        shojikubai, completed_tier, timer_minutes, timer_started_at, completed_at,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.text,
      task.type,
      task.due,
      task.isHabit ? 1 : 0,
      task.status,
      task.classifySource,
      task.shojikubai ? JSON.stringify(task.shojikubai) : null,
      task.completedTier,
      task.timerMinutes,
      task.timerStartedAt,
      task.completedAt,
      task.createdAt,
      task.updatedAt,
    ]
  );
}

export async function listInbox(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks WHERE status = 'inbox' ORDER BY created_at ASC`
  );
  return rows.map(rowToTask);
}

export async function listToday(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks WHERE status = 'today' ORDER BY created_at ASC`
  );
  return rows.map(rowToTask);
}

export async function updateTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE tasks
     SET text = ?, type = ?, due = ?, is_habit = ?, status = ?, classify_source = ?,
         shojikubai = ?, completed_tier = ?, timer_minutes = ?, timer_started_at = ?,
         completed_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      task.text,
      task.type,
      task.due,
      task.isHabit ? 1 : 0,
      task.status,
      task.classifySource,
      task.shojikubai ? JSON.stringify(task.shojikubai) : null,
      task.completedTier,
      task.timerMinutes,
      task.timerStartedAt,
      task.completedAt,
      task.updatedAt,
      task.id,
    ]
  );
}

export async function removeTask(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM tasks WHERE id = ?`, [id]);
}
