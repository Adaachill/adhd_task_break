import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayout } from '@/hooks/useLayout';
import { shareText } from '@/services/share';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiTier, Task } from '@/types/task';

const TIER_BADGE: Record<ShojikubaiTier, { label: string; color: string; bg: string }> = {
  ume: { label: '梅', color: colors.blue, bg: 'rgba(91,141,239,0.18)' },
  take: { label: '竹', color: colors.accentTo, bg: 'rgba(139,92,246,0.18)' },
  matsu: { label: '松', color: '#FFD600', bg: 'rgba(255,214,0,0.15)' },
};

function DoneRow({ task }: { task: Task }) {
  const { fs } = useLayout();
  const isFire = task.type === 'fire';
  const badge = task.completedTier ? TIER_BADGE[task.completedTier] : null;
  const hasLag = !isFire && task.timeToStartSeconds != null;

  return (
    <View style={styles.row}>
      <Text style={[styles.check, { fontSize: fs.body }]}>✅</Text>
      <View style={styles.rowMain}>
        <Text style={[styles.rowText, { fontSize: fs.body }]} numberOfLines={2}>
          {task.text}
        </Text>
        {hasLag && (
          <Text style={[styles.rowSub, { fontSize: fs.caption }]}>
            🚀 取り掛かりまで {formatLag(task.timeToStartSeconds!)}
          </Text>
        )}
      </View>
      {isFire && task.workedMinutes != null && (
        <View style={[styles.badge, { backgroundColor: 'rgba(255,90,110,0.18)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.fireFrom, fontSize: fs.caption }]}>
            🔥 {task.workedMinutes}分
          </Text>
        </View>
      )}
      {/* 🔵 で 🚀 押下した場合の実測表示 */}
      {!isFire && task.workedMinutes != null && (
        <View style={[styles.badge, { backgroundColor: 'rgba(91,141,239,0.18)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.blue, fontSize: fs.caption }]}>
            ⏱ {task.workedMinutes}分
          </Text>
        </View>
      )}
      {badge && (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeTxt, { color: badge.color, fontSize: fs.caption }]}>
            {badge.label}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatLag(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}分`;
  return `${Math.floor(m / 60)}時間${m % 60}分`;
}

export default function LogScreen() {
  const { doneTasks, loadDoneToday } = useTaskStore();
  const { fs, isDesktop } = useLayout();

  // タブにフォーカスするたびに最新の完了タスクを再取得
  useFocusEffect(
    useCallback(() => {
      void loadDoneToday();
    }, [loadDoneToday])
  );

  const totalMinutes = useMemo(
    () => doneTasks.reduce((sum, t) => sum + (t.workedMinutes ?? 0), 0),
    [doneTasks]
  );
  const count = doneTasks.length;

  const headline =
    totalMinutes > 0 ? `今日 ${totalMinutes}分 動けた！` : `今日 ${count}個 動けた！`;

  const handleShare = () => {
    const lines = doneTasks.map((t) => {
      const tier = t.completedTier ? TIER_BADGE[t.completedTier].label : '';
      const min = t.workedMinutes != null ? `(${t.workedMinutes}分)` : '';
      return `✅ ${t.text} ${tier}${min}`.trim();
    });
    const msg = [
      `📣 ${headline}`,
      `クリアしたタスク ${count}個`,
      ...lines,
      '',
      '#タスクブレーキ で過集中にブレーキ',
    ].join('\n');
    void shareText(msg);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fs.title }]}>本日の褒めログ</Text>
        </View>

        {/* 大見出し */}
        <View style={styles.hero}>
          <Text style={[styles.heroText, { fontSize: fs.title * 1.5 }]}>{headline}</Text>
          {count > 0 && (
            <Text style={[styles.heroSub, { fontSize: fs.small }]}>
              {count}個のタスクをクリア
              {totalMinutes > 0 ? ` ・ ${totalMinutes}分集中` : ''}
            </Text>
          )}
        </View>

        {count === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyEmoji, { fontSize: fs.title * 2 }]}>🌱</Text>
            <Text style={[styles.emptyTitle, { fontSize: fs.body }]}>まだ今日のクリアはありません</Text>
            <Text style={[styles.emptyBody, { fontSize: fs.small }]}>
              「今日」タブで梅をひとつクリアするだけで、ここに記録されます。{'\n'}
              できなかったことは表示しません。できたことだけ祝います。
            </Text>
          </View>
        ) : (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {doneTasks.map((task) => (
                <DoneRow key={task.id} task={task} />
              ))}
            </ScrollView>

            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareBtn, { opacity: pressed ? 0.8 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="結果をシェア">
              <Text style={[styles.shareTxt, { fontSize: fs.body }]}>📤 結果をシェア</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  containerDesktop: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  heroText: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSub: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  check: {},
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowText: {
    color: colors.text,
    fontWeight: '500',
  },
  rowSub: {
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeTxt: {
    fontWeight: '700',
  },
  shareBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentFrom,
    alignItems: 'center',
  },
  shareTxt: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyEmoji: {},
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
