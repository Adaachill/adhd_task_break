import type { AiHistoryEntry, TaskEstimate } from './types';

/**
 * AI ベース URL。dev では `EXPO_PUBLIC_AI_BASE_URL` で `http://localhost:3000` 等を指定可能。
 * 未指定なら相対パスで `/api/ai` を叩く（本番 Vercel と同一オリジン）。
 */
function aiUrl(): string {
  const base = process.env.EXPO_PUBLIC_AI_BASE_URL;
  if (base && base.length > 0) return `${base.replace(/\/$/, '')}/api/ai`;
  return '/api/ai';
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const TIMEOUT_MS = 10_000;

async function postAi<T>(payload: unknown): Promise<T | null> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(aiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<T>;
    if (!json.ok || !json.data) return null;
    return json.data;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

function validEstimate(d: unknown): d is TaskEstimate {
  if (!d || typeof d !== 'object') return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.estimatedMinutes === 'number' &&
    typeof o.estimatedDifficulty === 'number' &&
    typeof o.estimatedResistance === 'number' &&
    typeof o.rationale === 'string'
  );
}

/**
 * 🔵 タスクの見積もりを AI に依頼。
 * AI 無効時・API 失敗時・タイムアウト時は null を返す（呼び出し側で UI を降格させる）。
 */
export async function estimateTask(
  taskText: string,
  history: AiHistoryEntry[],
  aiEnabled: boolean
): Promise<TaskEstimate | null> {
  if (!aiEnabled) return null;
  if (!taskText || taskText.trim().length === 0) return null;
  const data = await postAi<unknown>({
    mode: 'estimate',
    task: { text: taskText },
    history,
  });
  return validEstimate(data) ? data : null;
}
