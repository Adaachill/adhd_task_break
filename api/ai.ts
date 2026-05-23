/**
 * Vercel Edge Function: DeepSeek proxy for the ADHD task-break app.
 *
 * - Single endpoint POST /api/ai
 * - Modes: 'estimate' (now), 'feedback' (PR-C)
 * - Request:  { mode, task: { text, type? }, history?: [...] }
 * - Response: { ok: true, data: TaskEstimate } | { ok: false, error: string }
 *
 * Secrets (set in Vercel dashboard, NOT committed):
 *   DEEPSEEK_API_KEY  – required
 *   DEEPSEEK_API_URL  – optional override, defaults to https://api.deepseek.com/chat/completions
 *   DEEPSEEK_MODEL    – optional override, defaults to 'deepseek-chat'
 */

export const config = { runtime: 'edge' };

const DEFAULT_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-chat';
const TIMEOUT_MS = 8_000;

// Naive in-memory rate limit. Edge functions don't share memory across regions,
// so this is best-effort abuse mitigation rather than a hard quota.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateMap = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateMap.set(ip, arr);
  return arr.length > RATE_MAX;
}

interface HistoryEntry {
  text: string;
  estimatedMinutes?: number | null;
  workedMinutes?: number | null;
  completedTier?: 'ume' | 'take' | 'matsu' | null;
}

const ESTIMATE_SYSTEM = `あなたはADHD当事者を支える優しいコーチです。
タスクの内容と過去履歴から、現実的な所要時間・難易度・抵抗感を推定します。
ADHDの楽観バイアスを考慮し、ユーザの過去の「見積もり vs 実測」の比率から補正してください。
出力は厳密に次の JSON のみ。説明文や前置きは禁止。
{
  "estimatedMinutes": <5から180の整数>,
  "estimatedDifficulty": <1から5の整数。1=楽、5=きつい>,
  "estimatedResistance": <1から5の整数。1=やる気あり、5=気が重い>,
  "rationale": "<30字以内の根拠>"
}`;

function buildEstimateUserMessage(taskText: string, history: HistoryEntry[]): string {
  const lines: string[] = [];
  lines.push(`タスク: ${taskText}`);
  if (history.length > 0) {
    lines.push('');
    lines.push('過去履歴（見積もり/実測/達成）:');
    for (const h of history.slice(0, 10)) {
      const est = h.estimatedMinutes ?? '?';
      const act = h.workedMinutes ?? '?';
      const tier = h.completedTier ?? '-';
      lines.push(`- "${h.text}" 見積${est}分/実測${act}分/${tier}`);
    }
  }
  return lines.join('\n');
}

function parseEstimate(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;
    const m = parsed.estimatedMinutes;
    const d = parsed.estimatedDifficulty;
    const r = parsed.estimatedResistance;
    if (typeof m !== 'number' || m < 1 || m > 480) return null;
    if (typeof d !== 'number' || d < 1 || d > 5) return null;
    if (typeof r !== 'number' || r < 1 || r > 5) return null;
    return {
      estimatedMinutes: Math.round(m),
      estimatedDifficulty: Math.round(d),
      estimatedResistance: Math.round(r),
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 60) : '',
    };
  } catch {
    return null;
  }
}

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured');
  const url = process.env.DEEPSEEK_API_URL ?? DEFAULT_URL;
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('Empty response from DeepSeek');
    return content;
  } finally {
    clearTimeout(tid);
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  if (rateLimited(ip)) {
    return jsonResponse(429, { ok: false, error: 'Rate limit exceeded' });
  }

  let body: {
    mode?: string;
    task?: { text?: string; type?: string };
    history?: HistoryEntry[];
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'Invalid JSON' });
  }

  const taskText = body.task?.text?.trim();
  if (!taskText || taskText.length > 500) {
    return jsonResponse(400, { ok: false, error: 'task.text required (<=500 chars)' });
  }
  const history = Array.isArray(body.history) ? body.history.slice(0, 10) : [];

  try {
    if (body.mode === 'estimate') {
      const content = await callDeepSeek(
        ESTIMATE_SYSTEM,
        buildEstimateUserMessage(taskText, history)
      );
      const parsed = parseEstimate(content);
      if (!parsed) {
        return jsonResponse(502, { ok: false, error: 'Invalid AI response shape' });
      }
      return jsonResponse(200, { ok: true, data: parsed });
    }
    return jsonResponse(400, { ok: false, error: `Unknown mode: ${body.mode}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return jsonResponse(502, { ok: false, error: msg });
  }
}
