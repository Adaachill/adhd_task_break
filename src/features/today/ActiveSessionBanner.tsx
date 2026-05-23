import { StyleSheet, Text, View } from 'react-native';

import { useCountdown } from '@/hooks/useCountdown';
import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';

/**
 * 🔥 ブレーキタイマー実行中に画面上部へ固定表示するバナー（spec ⑥）。
 * 「〇〇 を作業中 — 残り MM:SS」を表示し、他タブから戻ってきても作業中であることを忘れないようにする。
 */
export function ActiveSessionBanner() {
  const { fs } = useLayout();
  const active = useTaskStore((s) =>
    s.todayTasks.find(
      (t) =>
        t.type === 'fire' && t.timerStartedAt !== null && t.status === 'today'
    )
  );

  // Hooks 順序固定のため active 無し時もフックは呼ぶ
  const { formatted, isExpired } = useCountdown(
    active?.timerStartedAt ?? null,
    active?.timerMinutes ?? null
  );

  if (!active) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.dot} />
      <Text style={[styles.label, { fontSize: fs.caption }]} numberOfLines={1}>
        🔥 作業中：{active.text}
      </Text>
      <Text style={[styles.time, { fontSize: fs.caption }]}>
        {isExpired ? '時間切れ' : `残り ${formatted}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255,90,110,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,110,0.4)',
    borderRadius: radius.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.fireFrom,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontWeight: '600',
  },
  time: {
    color: colors.fireFrom,
    fontWeight: '700',
  },
});
