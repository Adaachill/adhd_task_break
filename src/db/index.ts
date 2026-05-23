import * as SQLite from 'expo-sqlite';

const DB_NAME = 'taskbrake.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// シングルトンで DB を開き、初回にマイグレーションを実行する。
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      text TEXT NOT NULL,
      type TEXT,
      due TEXT,
      is_habit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'inbox',
      classify_source TEXT NOT NULL DEFAULT 'unclassified',
      shojikubai TEXT,
      completed_tier TEXT,
      timer_minutes INTEGER,
      timer_started_at INTEGER,
      worked_minutes INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);

  // 既存DBへの追加カラムマイグレーション（ALTER TABLE は既存カラムがあるとエラーになるため無視）
  for (const col of [
    'ALTER TABLE tasks ADD COLUMN completed_tier TEXT',
    'ALTER TABLE tasks ADD COLUMN timer_started_at INTEGER',
    'ALTER TABLE tasks ADD COLUMN worked_minutes INTEGER',
    'ALTER TABLE tasks ADD COLUMN completed_at INTEGER',
    // 🔵 計測ループ（PR-A）
    'ALTER TABLE tasks ADD COLUMN moved_to_today_at INTEGER',
    'ALTER TABLE tasks ADD COLUMN blue_started_at INTEGER',
    'ALTER TABLE tasks ADD COLUMN time_to_start_seconds INTEGER',
    'ALTER TABLE tasks ADD COLUMN continued INTEGER',
  ]) {
    try {
      await db.execAsync(col);
    } catch {
      // カラムがすでに存在する場合はスキップ
    }
  }
}
