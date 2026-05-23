import { create } from 'zustand';

import { insertTask, listDoneBetween, listInbox, listToday, updateTask } from '@/db/taskRepo';
import { estimateTask as aiEstimateTask } from '@/services/ai/deepseek';
import type { AiHistoryEntry } from '@/services/ai/types';
import { classify } from '@/services/classify';
import type { ClassificationPatch, ShojikubaiTier, Task } from '@/types/task';

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface TaskState {
  tasks: Task[]; // inbox
  todayTasks: Task[]; // status='today'
  doneTasks: Task[]; // 本日完了（褒めログ用）
  aiEnabled: boolean;
  loaded: boolean;

  loadInbox: () => Promise<void>;
  loadToday: () => Promise<void>;
  loadDoneToday: () => Promise<void>;
  addTask: (text: string) => Promise<void>;
  updateClassification: (id: string, patch: ClassificationPatch) => Promise<void>;
  setAiEnabled: (enabled: boolean) => void;

  // 画面2: 今日やる
  moveToToday: (id: string) => Promise<void>;
  moveToInbox: (id: string) => Promise<void>;
  // 🔵 「🚀 始める」押下（取り掛かり時刻を記録）
  startBlueTask: (id: string) => Promise<void>;
  // 🔵 松竹梅達成
  completeShojikubai: (id: string, tier: ShojikubaiTier) => Promise<void>;
  // 🔥 ブレーキタイマー
  startBrakeTimer: (id: string, minutes: number, notificationId?: string) => Promise<void>;
  stopBrakeTimer: (id: string) => Promise<void>;
  // 🔥 タスク完了（実測分数を記録）
  completeFireTask: (id: string, workedMinutes: number) => Promise<void>;
}

// 当日の 0:00〜翌0:00 のエポックms範囲
function todayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  todayTasks: [],
  doneTasks: [],
  aiEnabled: true,
  loaded: false,

  loadInbox: async () => {
    const tasks = await listInbox();
    set({ tasks, loaded: true });
  },

  loadToday: async () => {
    const todayTasks = await listToday();
    set({ todayTasks });
  },

  loadDoneToday: async () => {
    const { start, end } = todayRange();
    const doneTasks = await listDoneBetween(start, end);
    set({ doneTasks });
  },

  addTask: async (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    const now = Date.now();
    const result = await classify(text, get().aiEnabled);
    const task: Task = {
      id: genId(),
      text,
      type: result.type,
      due: result.due,
      isHabit: false,
      status: 'inbox',
      classifySource: result.type || result.due ? 'ai' : 'unclassified',
      shojikubai: null,
      completedTier: null,
      timerMinutes: null,
      timerStartedAt: null,
      workedMinutes: null,
      movedToTodayAt: null,
      blueStartedAt: null,
      timeToStartSeconds: null,
      continued: null,
      estimatedMinutes: null,
      estimatedDifficulty: null,
      estimatedResistance: null,
      estimateRationale: null,
      estimateSource: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    set((s) => ({ tasks: [...s.tasks, task] }));
    await insertTask(task);
  },

  updateClassification: async (id, patch) => {
    const current = get().tasks.find((t) => t.id === id);
    if (!current) return;

    const updated: Task = {
      ...current,
      ...patch,
      classifySource: patch.classifySource ?? 'manual',
      updatedAt: Date.now(),
    };

    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    await updateTask(updated);
  },

  setAiEnabled: (enabled) => set({ aiEnabled: enabled }),

  // inbox → today（最大3枠チェックは呼び出し側で行う）
  moveToToday: async (id: string) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    // 取り掛かりラグの起点を記録（🔵 の計測ループ）
    const updated: Task = {
      ...task,
      status: 'today',
      movedToTodayAt: now,
      updatedAt: now,
    };
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      todayTasks: [...s.todayTasks, updated],
    }));
    await updateTask(updated);

    // 🔵 のみ AI 見積もり（fire-and-forget。失敗は UI 側で無表示に降格）
    if (updated.type === 'blue' && get().aiEnabled && updated.estimatedMinutes === null) {
      void requestBlueEstimate(updated, get, set);
    }
  },

  // today → inbox（タイマーもリセット。計測値も破棄）
  moveToInbox: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      status: 'inbox',
      timerStartedAt: null,
      movedToTodayAt: null,
      blueStartedAt: null,
      timeToStartSeconds: null,
      // 見積もりは保持（再昇格時に流用）
      updatedAt: Date.now(),
    };
    set((s) => ({
      todayTasks: s.todayTasks.filter((t) => t.id !== id),
      tasks: [...s.tasks, updated],
    }));
    await updateTask(updated);
  },

  // 🔵 「🚀 始める」（取り掛かり時刻 + 取り掛かりラグを記録）
  startBlueTask: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task || task.blueStartedAt !== null) return;

    const now = Date.now();
    const lagSec =
      task.movedToTodayAt !== null
        ? Math.max(0, Math.round((now - task.movedToTodayAt) / 1000))
        : null;

    const updated: Task = {
      ...task,
      blueStartedAt: now,
      timeToStartSeconds: lagSec,
      updatedAt: now,
    };
    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 🔵 松竹梅達成 → done
  completeShojikubai: async (id: string, tier: ShojikubaiTier) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    // 🚀 押下済みなら実測分数を計算（最低1分）。押してなければ null のまま。
    const worked =
      task.blueStartedAt !== null
        ? Math.max(1, Math.round((now - task.blueStartedAt) / 60_000))
        : null;

    const updated: Task = {
      ...task,
      status: 'done',
      completedTier: tier,
      workedMinutes: worked,
      // 中断機能は後続。完了到達 = 継続成功とみなす
      continued: task.blueStartedAt !== null ? true : null,
      completedAt: now,
      updatedAt: now,
    };

    set((s) => ({
      todayTasks: s.todayTasks.filter((t) => t.id !== id),
      doneTasks: [updated, ...s.doneTasks],
    }));
    await updateTask(updated);
  },

  // 🔥 タイマー開始（絶対時刻ベース）
  startBrakeTimer: async (id: string, minutes: number, notificationId?: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      timerMinutes: minutes,
      timerStartedAt: Date.now(),
      // notificationId を shojikubai フィールドには入れず、将来の拡張カラムを想定
      updatedAt: Date.now(),
    };

    // notificationId はメモリのみ保持（キャンセル用）
    if (notificationId) {
      notifMap.set(id, notificationId);
    }

    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 🔥 タイマー停止（タイマーだけリセット。タスクは today に残る）
  stopBrakeTimer: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      timerStartedAt: null,
      updatedAt: Date.now(),
    };

    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 🔥 タスク完了 → done（実測分数を記録）
  completeFireTask: async (id: string, workedMinutes: number) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: 'done',
      timerStartedAt: null,
      workedMinutes,
      completedAt: now,
      updatedAt: now,
    };

    set((s) => ({
      todayTasks: s.todayTasks.filter((t) => t.id !== id),
      doneTasks: [updated, ...s.doneTasks],
    }));
    await updateTask(updated);
  },
}));

// 通知IDのメモリキャッシュ（再起動時は失われるが、タイマー停止時のキャンセルに使う）
export const notifMap = new Map<string, string>();

// AI 見積もり中のタスク id（再起動でクリア）。UI のローディング表示用。
export const useEstimatingIds = create<{ ids: Set<string>; mark: (id: string, on: boolean) => void }>((set) => ({
  ids: new Set(),
  mark: (id, on) =>
    set((s) => {
      const next = new Set(s.ids);
      if (on) next.add(id);
      else next.delete(id);
      return { ids: next };
    }),
}));

/**
 * 直近完了タスクから AI に渡す履歴を組み立てる（最大10件）。
 * 「見積もり vs 実測」の傾向を学習させ、ユーザ固有の楽観バイアスを補正させる狙い。
 */
function buildHistory(doneTasks: Task[]): AiHistoryEntry[] {
  return doneTasks.slice(0, 10).map((t) => ({
    text: t.text,
    estimatedMinutes: t.estimatedMinutes,
    workedMinutes: t.workedMinutes,
    completedTier: t.completedTier,
  }));
}

/**
 * AI 見積もりを取得して DB / store に反映。失敗時は何もしない（UI は無表示に降格）。
 */
async function requestBlueEstimate(
  task: Task,
  get: () => TaskState,
  set: (partial: Partial<TaskState> | ((s: TaskState) => Partial<TaskState>)) => void
): Promise<void> {
  useEstimatingIds.getState().mark(task.id, true);
  try {
    const history = buildHistory(get().doneTasks);
    const result = await aiEstimateTask(task.text, history, get().aiEnabled);
    if (!result) return;

    const fresh = get().todayTasks.find((t) => t.id === task.id);
    // 移動して別ステータスになっていたら反映を捨てる
    if (!fresh || fresh.status !== 'today') return;

    const updated: Task = {
      ...fresh,
      estimatedMinutes: result.estimatedMinutes,
      estimatedDifficulty: result.estimatedDifficulty,
      estimatedResistance: result.estimatedResistance,
      estimateRationale: result.rationale,
      estimateSource: 'ai',
      updatedAt: Date.now(),
    };
    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === task.id ? updated : t)),
    }));
    await updateTask(updated);
  } finally {
    useEstimatingIds.getState().mark(task.id, false);
  }
}
