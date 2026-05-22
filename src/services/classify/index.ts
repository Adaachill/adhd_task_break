import { HeuristicClassifier } from './heuristic';
import type { ClassifyResult, Classifier } from './types';

export type { ClassifyResult, Classifier } from './types';

// 既定はローカル・ヒューリスティック。
// 将来: aiEnabled かつネットワーク可なら RemoteClassifier(FastAPI+Claude) を返す。
const heuristic = new HeuristicClassifier();

export function getClassifier(aiEnabled: boolean): Classifier {
  // remote 実装は後続フェーズで差し替え。現状は常にローカル。
  void aiEnabled;
  return heuristic;
}

// 分類を実行。AIオフ時は分類しない（未分類で返す = 手動のみ運用）。
export async function classify(text: string, aiEnabled: boolean): Promise<ClassifyResult> {
  if (!aiEnabled) return { type: null, due: null, confidence: 0 };
  return getClassifier(aiEnabled).classify(text);
}
