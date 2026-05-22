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
      timer_minutes INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);
}
