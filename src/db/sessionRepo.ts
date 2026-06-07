import { getDb } from '@/db';

export type SessionKind = 'blue' | 'fire';

export interface WorkSession {
  id: string;
  taskId: string;
  kind: SessionKind;
  startedAt: number;
  endedAt: number | null;
  createdAt: number;
}

interface WorkSessionRow {
  id: string;
  task_id: string;
  kind: string;
  started_at: number;
  ended_at: number | null;
  created_at: number;
}

function rowToSession(r: WorkSessionRow): WorkSession {
  return {
    id: r.id,
    taskId: r.task_id,
    kind: r.kind as SessionKind,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    createdAt: r.created_at,
  };
}

function genId(): string {
  return `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 開始: 既に開いているセッションがあれば閉じてから新規作成（多重openの保険）。
export async function openSession(taskId: string, kind: SessionKind, startedAt: number = Date.now()): Promise<WorkSession> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE work_sessions SET ended_at = ? WHERE task_id = ? AND ended_at IS NULL`,
    [startedAt, taskId]
  );
  const session: WorkSession = {
    id: genId(),
    taskId,
    kind,
    startedAt,
    endedAt: null,
    createdAt: startedAt,
  };
  await db.runAsync(
    `INSERT INTO work_sessions (id, task_id, kind, started_at, ended_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`,
    [session.id, session.taskId, session.kind, session.startedAt, session.createdAt]
  );
  return session;
}

// 終了: 当該タスクの未完了セッションを閉じる。複数あればすべて閉じる。
export async function closeOpenSession(taskId: string, endedAt: number = Date.now()): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE work_sessions SET ended_at = ? WHERE task_id = ? AND ended_at IS NULL`,
    [endedAt, taskId]
  );
}

// タスクの累計作業分数（閉じたセッションのみ集計、最低1分丸め）。
export async function sumTaskMinutes(taskId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total_ms: number | null }>(
    `SELECT COALESCE(SUM(ended_at - started_at), 0) AS total_ms
       FROM work_sessions
      WHERE task_id = ? AND ended_at IS NOT NULL`,
    [taskId]
  );
  const ms = row?.total_ms ?? 0;
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / 60_000));
}

// 指定範囲内に started_at を持つセッションのみ集計（習慣の日次リセット用）。
// 範囲外で開始したセッションは丸ごと除外（日跨ぎは開始日に帰属させる）。
export async function sumTaskMinutesBetween(taskId: string, startMs: number, endMs: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total_ms: number | null }>(
    `SELECT COALESCE(SUM(COALESCE(ended_at, ?) - started_at), 0) AS total_ms
       FROM work_sessions
      WHERE task_id = ?
        AND started_at >= ?
        AND started_at < ?`,
    [Date.now(), taskId, startMs, endMs]
  );
  const ms = row?.total_ms ?? 0;
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / 60_000));
}

// 当日 0:00〜翌0:00 の作業分数（習慣の日次表示用）
export async function sumTaskMinutesToday(taskId: string): Promise<number> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return sumTaskMinutesBetween(taskId, start, start + 24 * 60 * 60 * 1000);
}

// 指定 task_id 群について、範囲内の閉じたセッションを返す（ヒートマップ集計用）。
export interface SessionAggregateRow {
  taskId: string;
  startedAt: number;
  minutes: number;
}

export async function listSessionsForTasksBetween(
  taskIds: string[],
  startMs: number,
  endMs: number
): Promise<SessionAggregateRow[]> {
  if (taskIds.length === 0) return [];
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ task_id: string; started_at: number; ended_at: number | null }>(
    `SELECT task_id, started_at, ended_at FROM work_sessions
      WHERE task_id IN (${placeholders})
        AND started_at >= ?
        AND started_at < ?`,
    [...taskIds, startMs, endMs]
  );
  const now = Date.now();
  return rows.map((r) => {
    const end = r.ended_at ?? now;
    const ms = Math.max(0, end - r.started_at);
    return {
      taskId: r.task_id,
      startedAt: r.started_at,
      minutes: ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60_000)),
    };
  });
}

export async function listSessions(taskId: string): Promise<WorkSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkSessionRow>(
    `SELECT * FROM work_sessions WHERE task_id = ? ORDER BY started_at ASC`,
    [taskId]
  );
  return rows.map(rowToSession);
}
