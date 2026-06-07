import { create } from 'zustand';

import { insertTask, listDoneBetween, listInbox, listToday, updateTask } from '@/db/taskRepo';
import { closeOpenSession, openSession, sumTaskMinutes, sumTaskMinutesToday } from '@/db/sessionRepo';
import { estimateTask as aiEstimateTask } from '@/services/ai/deepseek';
import type { AiHistoryEntry } from '@/services/ai/types';
import { classify } from '@/services/classify';
import type { ClassificationPatch, ShojikubaiDef, ShojikubaiEstimates, ShojikubaiTier, Task } from '@/types/task';

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
  // 🔵 「🚀 始める」押下（取り掛かり時刻を記録。再開時も同じアクション）
  startBlueTask: (id: string) => Promise<void>;
  // 🔵 中断（時計を止める。再開は startBlueTask）
  pauseBlueTask: (id: string) => Promise<void>;
  // 🔵 松竹梅定義を更新
  updateShojikubai: (id: string, def: ShojikubaiDef) => Promise<void>;
  // 🔵 松竹梅達成
  completeShojikubai: (id: string, tier: ShojikubaiTier) => Promise<void>;
  // 🔥 ブレーキタイマー
  startBrakeTimer: (id: string, minutes: number, goal: string, notificationId?: string) => Promise<void>;
  // 🔥 タイマーを止める。stopは中断扱いで、経過時間を workedMinutes に積算する
  stopBrakeTimer: (id: string) => Promise<void>;
  // 🔥 タスク完了（実測分数を記録）
  completeFireTask: (id: string, workedMinutes: number) => Promise<void>;
  // 完了タスクを今日のタスクに戻す（追加作業・より上の松竹梅基準のため）
  reopenTask: (id: string) => Promise<void>;
  // doneTasks に対する編集（ほめログ画面用）
  updateDoneTask: (
    id: string,
    patch: Partial<Pick<Task, 'text' | 'type' | 'due' | 'isHabit' | 'estimatedMinutes' | 'estimateSource' | 'timerMinutes' | 'timerGoal' | 'workedMinutes'>>
  ) => Promise<void>;
  // 🔵 松竹梅の見積もり分数を更新
  updateShojikubaiEstimates: (id: string, estimates: ShojikubaiEstimates) => Promise<void>;
  // 今日のタスクの編集（テキスト・タイプ・期限・習慣・見積もり分数）
  updateTodayTask: (
    id: string,
    patch: Partial<Pick<Task, 'text' | 'type' | 'due' | 'isHabit' | 'estimatedMinutes' | 'estimateSource' | 'timerMinutes'>>
  ) => Promise<void>;
}

// 習慣タスクは「今日の分数」だけを workedMinutes に反映する（毎日リセット）。
// 単発タスクは従来どおり全期間合算。
async function sumWorked(task: Pick<Task, 'id' | 'isHabit'>): Promise<number> {
  return task.isHabit ? sumTaskMinutesToday(task.id) : sumTaskMinutes(task.id);
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
    const { start, end } = todayRange();
    const todayTasks = await listToday(start, end);
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

    // 当日のタスクがあれば前回の分類を引き継ぐ。なければデフォルト（動ける/今日/単発）
    const prevTask = get().tasks.at(-1);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const prevIsToday = prevTask != null && prevTask.createdAt >= todayStart.getTime();
    const fallback = prevIsToday
      ? { type: prevTask!.type, due: prevTask!.due, isHabit: prevTask!.isHabit }
      : { type: 'blue' as const, due: 'today' as const, isHabit: false };

    const task: Task = {
      id: genId(),
      text,
      type: result.type ?? fallback.type,
      due: result.due ?? fallback.due,
      isHabit: fallback.isHabit,
      status: 'inbox',
      classifySource: result.type || result.due ? 'ai' : prevIsToday ? 'manual' : 'unclassified',
      shojikubai: null,
      completedTier: null,
      shojikubaiEstimates: null,
      timerMinutes: null,
      timerStartedAt: null,
      timerGoal: null,
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

    const isClassificationChange = 'type' in patch || 'due' in patch || 'isHabit' in patch;
    const updated: Task = {
      ...current,
      ...patch,
      classifySource: patch.classifySource ?? (isClassificationChange ? 'manual' : current.classifySource),
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

  // 🔵 「🚀 始める / 再開」（取り掛かり時刻 + 取り掛かりラグを記録）
  startBlueTask: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    // 初回のみ取り掛かりラグを計算
    const lagSec =
      task.timeToStartSeconds !== null
        ? task.timeToStartSeconds
        : task.movedToTodayAt !== null
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
    await openSession(id, 'blue', now);
  },

  // 🔵 中断（blueStartedAt をリセット。セッションを閉じて累計を再計算）
  pauseBlueTask: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task || task.blueStartedAt === null) return;

    const now = Date.now();
    await closeOpenSession(id, now);
    const accumulated = await sumWorked(task);

    const updated: Task = {
      ...task,
      blueStartedAt: null,
      workedMinutes: accumulated > 0 ? accumulated : task.workedMinutes,
      continued: false,
      updatedAt: now,
    };
    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 🔵 松竹梅定義を更新
  updateShojikubai: async (id: string, def: ShojikubaiDef) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = { ...task, shojikubai: def, updatedAt: Date.now() };
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
    // 走行中セッションがあれば閉じてから累計を再計算
    if (task.blueStartedAt !== null) {
      await closeOpenSession(id, now);
    }
    const summed = await sumWorked(task);
    const totalWorked = summed > 0 ? summed : task.workedMinutes;

    const updated: Task = {
      ...task,
      status: 'done',
      completedTier: tier,
      workedMinutes: totalWorked,
      continued: (task.blueStartedAt !== null || task.continued === false) ? true : null,
      completedAt: now,
      updatedAt: now,
    };

    // 習慣化タスクは完了しても今日のタスクタブに残す（再開・追加作業のため）
    set((s) => ({
      todayTasks: updated.isHabit
        ? s.todayTasks.map((t) => (t.id === id ? updated : t))
        : s.todayTasks.filter((t) => t.id !== id),
      doneTasks: [updated, ...s.doneTasks.filter((t) => t.id !== id)],
    }));
    await updateTask(updated);
  },

  // 🔥 タイマー開始（絶対時刻ベース）
  startBrakeTimer: async (id: string, minutes: number, goal: string, notificationId?: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    const updated: Task = {
      ...task,
      timerMinutes: minutes,
      timerStartedAt: now,
      timerGoal: goal,
      updatedAt: now,
    };

    // notificationId はメモリのみ保持（キャンセル用）
    if (notificationId) {
      notifMap.set(id, notificationId);
    }

    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
    await openSession(id, 'fire', now);
  },

  // 🔥 タイマー停止（中断扱い。セッションを閉じて累計を再計算）
  stopBrakeTimer: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    await closeOpenSession(id, now);
    const accumulated = await sumWorked(task);

    const updated: Task = {
      ...task,
      timerStartedAt: null,
      workedMinutes: accumulated > 0 ? accumulated : task.workedMinutes,
      updatedAt: now,
    };

    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 🔵 松竹梅の見積もり分数を更新
  updateShojikubaiEstimates: async (id: string, estimates: ShojikubaiEstimates) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      shojikubaiEstimates: estimates,
      updatedAt: Date.now(),
    };
    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 今日のタスクの編集（テキスト・タイプ・期限・習慣・見積もり分数など）
  updateTodayTask: async (id, patch) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      ...patch,
      updatedAt: Date.now(),
    };
    set((s) => ({
      todayTasks: s.todayTasks.map((t) => (t.id === id ? updated : t)),
    }));
    await updateTask(updated);
  },

  // 🔥 タスク完了 → done（セッション合算で実測分数を確定）
  completeFireTask: async (id: string, workedMinutes: number) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    // 走行中セッションがあれば閉じてから累計を再計算（中断・再開を含む全期間が正しく合算される）
    if (task.timerStartedAt !== null) {
      await closeOpenSession(id, now);
    }
    const summed = await sumWorked(task);
    const finalWorked = summed > 0 ? summed : workedMinutes;

    const updated: Task = {
      ...task,
      status: 'done',
      timerStartedAt: null,
      workedMinutes: finalWorked,
      completedAt: now,
      updatedAt: now,
    };

    // 習慣化タスクは完了しても今日のタスクタブに残す
    set((s) => ({
      todayTasks: updated.isHabit
        ? s.todayTasks.map((t) => (t.id === id ? updated : t))
        : s.todayTasks.filter((t) => t.id !== id),
      doneTasks: [updated, ...s.doneTasks.filter((t) => t.id !== id)],
    }));
    await updateTask(updated);
  },

  // 完了タスクの再開（褒めログから / 今日タブの完了済み習慣から）
  // 達成情報は保持しつつ、status を today に戻して追加作業を可能にする
  reopenTask: async (id: string) => {
    const task =
      get().doneTasks.find((t) => t.id === id) ??
      get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    // 習慣タスクは新しい日に再開した場合 workedMinutes を 0 にリセット（日次リセット仕様）
    const { start: todayStart } = todayRange();
    const resetHabitMinutes =
      task.isHabit && task.completedAt != null && task.completedAt < todayStart;
    const updated: Task = {
      ...task,
      status: 'today',
      // 達成情報をクリアして、再度より上の基準を選べるようにする
      completedTier: null,
      completedAt: null,
      // 🔥 のタイマーは止まった状態に戻す
      timerStartedAt: null,
      // 取り掛かりラグ計測の起点を再設定
      movedToTodayAt: task.movedToTodayAt ?? now,
      workedMinutes: resetHabitMinutes ? null : task.workedMinutes,
      updatedAt: now,
    };

    set((s) => {
      const inToday = s.todayTasks.some((t) => t.id === id);
      return {
        todayTasks: inToday
          ? s.todayTasks.map((t) => (t.id === id ? updated : t))
          : [...s.todayTasks, updated],
        doneTasks: s.doneTasks.filter((t) => t.id !== id),
      };
    });
    await updateTask(updated);
  },

  // doneTasks に対する編集（ほめログ画面用）
  updateDoneTask: async (id, patch) => {
    const task = get().doneTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      ...patch,
      updatedAt: Date.now(),
    };
    set((s) => ({
      doneTasks: s.doneTasks.map((t) => (t.id === id ? updated : t)),
      // habit の場合は todayTasks にも同じレコードが存在する
      todayTasks: s.todayTasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: updated.updatedAt } : t)),
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
