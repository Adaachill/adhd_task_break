import { getDb } from '@/db';
import type { ShojikubaiDef, Task } from '@/types/task';

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
  timer_minutes: number | null;
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
    timerMinutes: r.timer_minutes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function insertTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO tasks (id, text, type, due, is_habit, status, classify_source, shojikubai, timer_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.text,
      task.type,
      task.due,
      task.isHabit ? 1 : 0,
      task.status,
      task.classifySource,
      task.shojikubai ? JSON.stringify(task.shojikubai) : null,
      task.timerMinutes,
      task.createdAt,
      task.updatedAt,
    ]
  );
}

// 受信トレイ（吐き出し）を作成順に返す。
export async function listInbox(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks WHERE status = 'inbox' ORDER BY created_at ASC`
  );
  return rows.map(rowToTask);
}

export async function updateTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE tasks SET text = ?, type = ?, due = ?, is_habit = ?, status = ?, classify_source = ?, shojikubai = ?, timer_minutes = ?, updated_at = ?
     WHERE id = ?`,
    [
      task.text,
      task.type,
      task.due,
      task.isHabit ? 1 : 0,
      task.status,
      task.classifySource,
      task.shojikubai ? JSON.stringify(task.shojikubai) : null,
      task.timerMinutes,
      task.updatedAt,
      task.id,
    ]
  );
}

export async function removeTask(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM tasks WHERE id = ?`, [id]);
}
