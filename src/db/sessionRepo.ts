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

export async function listSessions(taskId: string): Promise<WorkSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<WorkSessionRow>(
    `SELECT * FROM work_sessions WHERE task_id = ? ORDER BY started_at ASC`,
    [taskId]
  );
  return rows.map(rowToSession);
}
