import { getDb } from '@/db';
import type { ShojikubaiDef, ShojikubaiEstimates, ShojikubaiTier, Task } from '@/types/task';

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
  worked_minutes: number | null;
  moved_to_today_at: number | null;
  blue_started_at: number | null;
  time_to_start_seconds: number | null;
  continued: number | null;
  estimated_minutes: number | null;
  estimated_difficulty: number | null;
  estimated_resistance: number | null;
  estimate_rationale: string | null;
  estimate_source: string | null;
  shojikubai_estimates: string | null;
  timer_goal: string | null;
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
    workedMinutes: r.worked_minutes,
    movedToTodayAt: r.moved_to_today_at,
    blueStartedAt: r.blue_started_at,
    timeToStartSeconds: r.time_to_start_seconds,
    continued: r.continued === null ? null : r.continued === 1,
    estimatedMinutes: r.estimated_minutes,
    estimatedDifficulty: r.estimated_difficulty,
    estimatedResistance: r.estimated_resistance,
    estimateRationale: r.estimate_rationale,
    estimateSource: (r.estimate_source as Task['estimateSource']) ?? null,
    shojikubaiEstimates: r.shojikubai_estimates
      ? (JSON.parse(r.shojikubai_estimates) as ShojikubaiEstimates)
      : null,
    timerGoal: r.timer_goal,
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
        shojikubai, completed_tier, timer_minutes, timer_started_at, worked_minutes,
        moved_to_today_at, blue_started_at, time_to_start_seconds, continued,
        estimated_minutes, estimated_difficulty, estimated_resistance,
        estimate_rationale, estimate_source, shojikubai_estimates, timer_goal,
        completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      task.workedMinutes,
      task.movedToTodayAt,
      task.blueStartedAt,
      task.timeToStartSeconds,
      task.continued === null ? null : task.continued ? 1 : 0,
      task.estimatedMinutes,
      task.estimatedDifficulty,
      task.estimatedResistance,
      task.estimateRationale,
      task.estimateSource,
      task.shojikubaiEstimates ? JSON.stringify(task.shojikubaiEstimates) : null,
      task.timerGoal,
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

export async function listToday(todayStartMs?: number, todayEndMs?: number): Promise<Task[]> {
  const db = await getDb();
  // 習慣化タスクは完了しても当日中は今日のタスクタブに残す（再開・追加作業のため）
  if (todayStartMs != null && todayEndMs != null) {
    const rows = await db.getAllAsync<TaskRow>(
      `SELECT * FROM tasks
       WHERE status = 'today'
          OR (status = 'done' AND is_habit = 1 AND completed_at >= ? AND completed_at < ?)
       ORDER BY created_at ASC`,
      [todayStartMs, todayEndMs]
    );
    return rows.map(rowToTask);
  }
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks WHERE status = 'today' ORDER BY created_at ASC`
  );
  return rows.map(rowToTask);
}

export async function listDoneBetween(startMs: number, endMs: number): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT * FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?
     ORDER BY completed_at DESC`,
    [startMs, endMs]
  );
  return rows.map(rowToTask);
}

export async function updateTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE tasks
     SET text = ?, type = ?, due = ?, is_habit = ?, status = ?, classify_source = ?,
         shojikubai = ?, completed_tier = ?, timer_minutes = ?, timer_started_at = ?,
         worked_minutes = ?, moved_to_today_at = ?, blue_started_at = ?,
         time_to_start_seconds = ?, continued = ?,
         estimated_minutes = ?, estimated_difficulty = ?, estimated_resistance = ?,
         estimate_rationale = ?, estimate_source = ?,
         shojikubai_estimates = ?,
         timer_goal = ?,
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
      task.workedMinutes,
      task.movedToTodayAt,
      task.blueStartedAt,
      task.timeToStartSeconds,
      task.continued === null ? null : task.continued ? 1 : 0,
      task.estimatedMinutes,
      task.estimatedDifficulty,
      task.estimatedResistance,
      task.estimateRationale,
      task.estimateSource,
      task.shojikubaiEstimates ? JSON.stringify(task.shojikubaiEstimates) : null,
      task.timerGoal,
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

// 入力中テキストと部分一致する過去タスクを返す（重複テキストは最新のみ、最大 limit 件）。
// 前方一致を後方一致より優先し、その中で updated_at の新しい順で並べる。
export async function searchSimilarTasks(query: string, limit: number = 5): Promise<Task[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const db = await getDb();
  const containsLike = `%${trimmed}%`;
  const prefixLike = `${trimmed}%`;
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT t.* FROM tasks t
     INNER JOIN (
       SELECT text, MAX(updated_at) AS max_updated
       FROM tasks
       WHERE text LIKE ?
       GROUP BY text
     ) latest ON t.text = latest.text AND t.updated_at = latest.max_updated
     ORDER BY (CASE WHEN t.text LIKE ? THEN 0 ELSE 1 END), t.updated_at DESC
     LIMIT ?`,
    [containsLike, prefixLike, limit]
  );
  return rows.map(rowToTask);
}
