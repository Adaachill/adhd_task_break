/** AI 見積もり結果（PR-B） */
export interface TaskEstimate {
  estimatedMinutes: number;
  estimatedDifficulty: 1 | 2 | 3 | 4 | 5;
  estimatedResistance: 1 | 2 | 3 | 4 | 5;
  rationale: string;
}

/** 履歴 1件（プロンプト調整用に AI へ送る） */
export interface AiHistoryEntry {
  text: string;
  estimatedMinutes: number | null;
  workedMinutes: number | null;
  completedTier: 'ume' | 'take' | 'matsu' | null;
}
