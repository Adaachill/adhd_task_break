// ルールベース褒めコメント生成
// 外部APIなし。完了タスク数・松竹梅割合・作業分数で分岐する。

export type PraiseContext = {
  count: number;
  totalMinutes: number;
  umeCount: number;
  takeCount: number;
  matsuCount: number;
  fireCount: number;
  firstTaskName?: string;
  fireMinutes?: number;
  matsuTaskName?: string;
};

export type PraiseResult = {
  headline: string;
  subline: string;
  comment: string;
};

export function buildPraiseComment(ctx: PraiseContext): PraiseResult {
  return {
    headline: pickHeadline(ctx),
    subline: ctx.totalMinutes > 0 ? '脳を動かしました！' : 'タスクをクリアしました！',
    comment: pickComment(ctx),
  };
}

function pickHeadline({ count, totalMinutes, matsuCount }: PraiseContext): string {
  if (matsuCount >= 1) return '今日は伝説級の偉業達成日';
  if (totalMinutes >= 90) return '今日のあなた、マジ偉い！';
  if (totalMinutes >= 60) return '1時間超え！今日は完全勝利';
  if (count >= 3) return '3個クリア！今日は無双デイ';
  if (totalMinutes >= 30) return '30分動いた、もう今日は勝ち確';
  if (totalMinutes >= 10) return '10分でも動けた、本物の勇気';
  return '動けた。それだけで今日は100点';
}

function pickComment(ctx: PraiseContext): string {
  const {
    umeCount, takeCount, matsuCount, fireCount,
    totalMinutes, count, firstTaskName, fireMinutes, matsuTaskName,
  } = ctx;

  // 松を達成した場合（最優先）
  if (matsuCount >= 1) {
    const name = matsuTaskName ? `『${matsuTaskName}』` : 'タスク';
    return `${name}で松まで到達したの、ほんとにすごい。「目指さなくてOK」って書いてあるのに、やりきった意志力は本物。誇っていい。`;
  }

  // 🔥 タスクで自制心を発揮した場合
  if (fireCount >= 1 && fireMinutes != null && fireMinutes > 0) {
    return `調べ物を時間通り${fireMinutes}分でブレーキをかけた自制心、誇っていいよ。過集中をセルフコントロールできる人、なかなかいないから。`;
  }

  // 梅しかない場合（最低限でも完了は完了）
  if (umeCount >= 1 && takeCount === 0 && matsuCount === 0 && fireCount === 0) {
    const name = firstTaskName ? `『${firstTaskName}』` : 'タスク';
    return `億劫だった${name}の梅をクリアしたの、マジで天才すぎる。梅でも完了は本物の完了。明日も超イージーにいこう！`;
  }

  // 長時間セッション
  if (totalMinutes >= 60) {
    return `${totalMinutes}分も脳を動かし続けた。これは相当すごいこと。今日は十分以上に頑張ったから、あとはゆっくり休んでいい。`;
  }

  // 多タスク達成
  if (count >= 3) {
    return `${count}個もクリアした。勢いに乗れた今日の自分を、ちゃんと覚えておいて。この感覚が明日のスタートダッシュになる。`;
  }

  // 中程度のセッション
  if (totalMinutes >= 20) {
    const name = firstTaskName ? `『${firstTaskName}』` : 'タスク';
    return `${name}をクリアした事実は消えない。「やろうと思っていた」で終わらず、実際に動いた。それだけで今日は大勝利。`;
  }

  // デフォルト
  return `今日動けたのは、気合いじゃなくて仕組みのおかげ。その仕組みを使い続けるだけで、毎日少しずつ動ける日が増えていく。明日も一緒に！`;
}
