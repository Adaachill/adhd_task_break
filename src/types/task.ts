// タスクのドメインモデル

// 🔵=動ける（松竹梅）/ 🔥=沼（ブレーキタイマー）。spec 1.2-1 により排他。
export type TaskType = 'blue' | 'fire';

// 期限ラベル（今日 / 明日 / いつか）
export type DueLabel = 'today' | 'tomorrow' | 'someday';

// 受信トレイ → 今日やる → 完了
export type TaskStatus = 'inbox' | 'today' | 'done';

// 分類の出どころ（AI / 手動補正 / 未分類）
export type ClassifySource = 'ai' | 'manual' | 'unclassified';

export interface Task {
  id: string;
  text: string;
  type: TaskType | null;
  due: DueLabel | null;
  isHabit: boolean;
  status: TaskStatus;
  classifySource: ClassifySource;

  // 将来の画面2用に確保（MVP本計画では未使用）
  // 🔵: 松竹梅の各定義 / 🔥: 制限分数
  shojikubai: ShojikubaiDef | null;
  timerMinutes: number | null;

  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface ShojikubaiDef {
  ume: string; // 梅: 1秒でできる行動
  take: string; // 竹: 通常の最低基準
  matsu: string; // 松: 目指さなくてOKな理想
}

// 分類で更新しうるフィールドのパッチ
export type ClassificationPatch = Partial<
  Pick<Task, 'type' | 'due' | 'isHabit' | 'classifySource'>
>;
