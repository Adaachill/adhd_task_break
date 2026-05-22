// ローカル・ヒューリスティック分類器。
// 外部送信なし・常にオフライン動作する既定フォールバック（spec 3.3）。
// 純粋関数のみ（RN 依存なし）で単体テスト可能。

import type { DueLabel, TaskType } from '@/types/task';
import type { ClassifyResult, Classifier } from './types';

// 🔥（沼／緊急・過集中しやすい）を示唆する語
const FIRE_KEYWORDS = [
  '急ぎ',
  '至急',
  '締切',
  '〆切',
  'しめきり',
  '期限',
  '今すぐ',
  'やばい',
  'ヤバい',
  '緊急',
  'asap',
  '即',
  '提出',
  '本番',
];

// 🔵（動ける・気が進まない軽作業）を示唆する語
const BLUE_KEYWORDS = [
  '気が進まない',
  'めんどい',
  '面倒',
  'だるい',
  'やりたくない',
  'とりあえず',
  '少し',
  'ちょっと',
  '整理',
  '掃除',
];

const TODAY_KEYWORDS = ['今日', 'きょう', '本日', '今すぐ', '今夜', '今朝'];
const TOMORROW_KEYWORDS = ['明日', 'あした', 'あす', '翌日'];
const SOMEDAY_KEYWORDS = ['いつか', 'そのうち', '今度', 'いずれ', '暇な時', 'ひまな時'];

function countHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((n, kw) => (lower.includes(kw.toLowerCase()) ? n + 1 : n), 0);
}

export function detectType(text: string): { type: TaskType | null; confidence: number } {
  const fire = countHits(text, FIRE_KEYWORDS);
  const blue = countHits(text, BLUE_KEYWORDS);
  if (fire === 0 && blue === 0) return { type: null, confidence: 0 };
  if (fire >= blue) return { type: 'fire', confidence: Math.min(1, 0.5 + 0.25 * fire) };
  return { type: 'blue', confidence: Math.min(1, 0.5 + 0.25 * blue) };
}

export function detectDue(text: string): { due: DueLabel | null; confidence: number } {
  if (countHits(text, TODAY_KEYWORDS) > 0) return { due: 'today', confidence: 0.8 };
  if (countHits(text, TOMORROW_KEYWORDS) > 0) return { due: 'tomorrow', confidence: 0.8 };
  if (countHits(text, SOMEDAY_KEYWORDS) > 0) return { due: 'someday', confidence: 0.7 };
  return { due: null, confidence: 0 };
}

// 信頼度の下限。これ未満は未分類（手動補正に委ねる）。
export const CONFIDENCE_THRESHOLD = 0.5;

export function classifyHeuristic(text: string): ClassifyResult {
  const t = detectType(text);
  const d = detectDue(text);
  const type = t.confidence >= CONFIDENCE_THRESHOLD ? t.type : null;
  const due = d.confidence >= CONFIDENCE_THRESHOLD ? d.due : null;
  // 全体信頼度はtype/dueのうち判定できた方の最大値
  const confidence = Math.max(type ? t.confidence : 0, due ? d.confidence : 0);
  return { type, due, confidence };
}

export class HeuristicClassifier implements Classifier {
  async classify(text: string): Promise<ClassifyResult> {
    return classifyHeuristic(text);
  }
}
