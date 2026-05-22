import type { DueLabel, TaskType } from '@/types/task';

export interface ClassifyResult {
  type: TaskType | null;
  due: DueLabel | null;
  // 0..1。低信頼時は未分類扱いにフォールバックする（spec 3.3）。
  confidence: number;
}

export interface Classifier {
  classify(text: string): Promise<ClassifyResult>;
}
