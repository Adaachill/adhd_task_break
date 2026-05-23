import { create } from 'zustand';

import { insertTask, listDoneBetween, listInbox, listToday, updateTask } from '@/db/taskRepo';
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

    const updated: Task = { ...task, status: 'today', updatedAt: Date.now() };
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      todayTasks: [...s.todayTasks, updated],
    }));
    await updateTask(updated);
  },

  // today → inbox（タイマーもリセット）
  moveToInbox: async (id: string) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      status: 'inbox',
      timerStartedAt: null,
      updatedAt: Date.now(),
    };
    set((s) => ({
      todayTasks: s.todayTasks.filter((t) => t.id !== id),
      tasks: [...s.tasks, updated],
    }));
    await updateTask(updated);
  },

  // 🔵 松竹梅達成 → done
  completeShojikubai: async (id: string, tier: ShojikubaiTier) => {
    const task = get().todayTasks.find((t) => t.id === id);
    if (!task) return;

    const now = Date.now();
    const updated: Task = {
      ...task,
      status: 'done',
      completedTier: tier,
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
