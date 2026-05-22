import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifyHeuristic, detectDue, detectType } from './heuristic';

test('detectType: 締切/急ぎ系は fire', () => {
  assert.equal(detectType('明日が締切のレポート').type, 'fire');
  assert.equal(detectType('至急で対応が必要').type, 'fire');
});

test('detectType: 気が進まない系は blue', () => {
  assert.equal(detectType('気が進まないけど部屋の掃除').type, 'blue');
  assert.equal(detectType('めんどいメール返信').type, 'blue');
});

test('detectType: 手がかりなしは null', () => {
  assert.equal(detectType('牛乳を買う').type, null);
});

test('detectDue: 今日/明日/いつか を判定', () => {
  assert.equal(detectDue('今日中にやる').due, 'today');
  assert.equal(detectDue('明日の朝に提出').due, 'tomorrow');
  assert.equal(detectDue('いつか読みたい本').due, 'someday');
  assert.equal(detectDue('本を読む').due, null);
});

test('classifyHeuristic: 低信頼は未分類にフォールバック', () => {
  const r = classifyHeuristic('牛乳を買う');
  assert.equal(r.type, null);
  assert.equal(r.due, null);
  assert.equal(r.confidence, 0);
});

test('classifyHeuristic: 締切+明日 を分類できる', () => {
  const r = classifyHeuristic('明日が締切の資料作成');
  assert.equal(r.type, 'fire');
  assert.equal(r.due, 'tomorrow');
  assert.ok(r.confidence >= 0.5);
});
