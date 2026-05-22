import { create } from 'zustand';

import { insertTask, listInbox, updateTask } from '@/db/taskRepo';
import { classify } from '@/services/classify';
import type { ClassificationPatch, Task } from '@/types/task';

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface TaskState {
  tasks: Task[];
  aiEnabled: boolean;
  loaded: boolean;

  loadInbox: () => Promise<void>;
  addTask: (text: string) => Promise<void>;
  updateClassification: (id: string, patch: ClassificationPatch) => Promise<void>;
  setAiEnabled: (enabled: boolean) => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  aiEnabled: true,
  loaded: false,

  loadInbox: async () => {
    const tasks = await listInbox();
    set({ tasks, loaded: true });
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
      timerMinutes: null,
      createdAt: now,
      updatedAt: now,
    };

    // 楽観的更新 → 永続化
    set((s) => ({ tasks: [...s.tasks, task] }));
    await insertTask(task);
  },

  // バッジ1タップ補正など、分類の手動更新
  updateClassification: async (id, patch) => {
    const current = get().tasks.find((t) => t.id === id);
    if (!current) return;

    const updated: Task = {
      ...current,
      ...patch,
      // 手動補正された場合は出どころを manual に
      classifySource: patch.classifySource ?? 'manual',
      updatedAt: Date.now(),
    };

    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    await updateTask(updated);
  },

  setAiEnabled: (enabled) => set({ aiEnabled: enabled }),
}));
