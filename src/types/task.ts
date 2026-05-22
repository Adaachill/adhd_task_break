// タスクのドメインモデル

// 🔵=動ける（松竹梅）/ 🔥=沼（ブレーキタイマー）。spec 1.2-1 により排他。
export type TaskType = 'blue' | 'fire';

// 期限ラベル（今日 / 明日 / いつか）
export type DueLabel = 'today' | 'tomorrow' | 'someday';

// 受信トレイ → 今日やる → 完了
export type TaskStatus = 'inbox' | 'today' | 'done';

// 分類の出どころ（AI / 手動補正 / 未分類）
export type ClassifySource = 'ai' | 'manual' | 'unclassified';

// 松竹梅の達成レベル
export type ShojikubaiTier = 'ume' | 'take' | 'matsu';

export interface Task {
  id: string;
  text: string;
  type: TaskType | null;
  due: DueLabel | null;
  isHabit: boolean;
  status: TaskStatus;
  classifySource: ClassifySource;

  // 🔵 松竹梅の各行動定義（ユーザーが書く or AI提案）
  shojikubai: ShojikubaiDef | null;
  // 🔵 完了時の達成レベル
  completedTier: ShojikubaiTier | null;

  // 🔥 制限分数（開始前に選択）
  timerMinutes: number | null;
  // 🔥 タイマー開始エポックms（絶対時刻ベース）
  timerStartedAt: number | null;

  completedAt: number | null; // 完了エポックms
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface ShojikubaiDef {
  ume: string; // 梅: 1秒でできる最低限の行動
  take: string; // 竹: 通常の最低基準
  matsu: string; // 松: 目指さなくてOKな理想
}

// 分類で更新しうるフィールドのパッチ
export type ClassificationPatch = Partial<
  Pick<Task, 'type' | 'due' | 'isHabit' | 'classifySource'>
>;
