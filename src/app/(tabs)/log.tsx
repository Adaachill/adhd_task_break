import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLayout } from '@/hooks/useLayout';
import { buildPraiseComment } from '@/services/praiseComment';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiTier, Task } from '@/types/task';

// 松竹梅 tier カラー定義
const TIER: Record<ShojikubaiTier, { label: string; color: string }> = {
  ume: { label: '梅', color: '#3DD68C' },
  take: { label: '竹', color: '#FF8A4C' },
  matsu: { label: '松', color: '#FFD600' },
};
const FIRE_COLOR = colors.fireFrom;

// タスク1件の行
function DoneRow({ task }: { task: Task }) {
  const { fs } = useLayout();
  const isFire = task.type === 'fire';
  const tier = task.completedTier ? TIER[task.completedTier] : null;
  const brakeApplied =
    isFire &&
    task.workedMinutes != null &&
    task.timerMinutes != null &&
    task.workedMinutes <= task.timerMinutes;

  const minuteLabel =
    task.workedMinutes != null
      ? ` (${task.workedMinutes}分${brakeApplied ? '・過集中回避!' : ''})`
      : '';

  const labelColor = tier ? tier.color : isFire ? FIRE_COLOR : colors.textSecondary;
  const labelText = tier ? tier.label : isFire ? '🔥' : '?';

  return (
    <View style={styles.row}>
      <View style={[styles.tierPill, { borderColor: labelColor }]}>
        <Text style={[styles.tierPillTxt, { color: labelColor, fontSize: fs.caption }]}>
          {labelText}
        </Text>
      </View>
      <Text style={[styles.rowText, { fontSize: fs.body }]} numberOfLines={2}>
        {task.text}
        <Text style={[styles.rowSub, { fontSize: fs.caption }]}>{minuteLabel}</Text>
      </Text>
    </View>
  );
}

// 達成状況を示すドット（最大5スロット）
function TierDots({ tasks }: { tasks: Task[] }) {
  const MAX = 5;
  const filled = tasks.map((t) => {
    if (t.completedTier) return TIER[t.completedTier].color;
    if (t.type === 'fire') return FIRE_COLOR;
    return colors.textSecondary;
  });
  const dots = [...filled, ...Array(Math.max(0, MAX - filled.length)).fill('rgba(255,255,255,0.12)')];

  return (
    <View style={styles.dots}>
      {dots.map((bg, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: bg as string }]} />
      ))}
    </View>
  );
}

export default function LogScreen() {
  const { doneTasks, loadDoneToday } = useTaskStore();
  const { fs, isDesktop } = useLayout();

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

  const praise = useMemo(() => {
    const umeCount = doneTasks.filter((t) => t.completedTier === 'ume').length;
    const takeCount = doneTasks.filter((t) => t.completedTier === 'take').length;
    const matsuCount = doneTasks.filter((t) => t.completedTier === 'matsu').length;
    const fireTasks = doneTasks.filter((t) => t.type === 'fire');
    const fireCount = fireTasks.length;

    const firstTask = doneTasks[0];
    const matsuTask = doneTasks.find((t) => t.completedTier === 'matsu');
    // 🔥 タスクの実作業分数（ブレーキが効いたもの優先）
    const brakeTask = fireTasks.find(
      (t) => t.workedMinutes != null && t.timerMinutes != null && t.workedMinutes <= t.timerMinutes
    );
    const fireMinutes = brakeTask?.workedMinutes ?? fireTasks[0]?.workedMinutes ?? undefined;

    return buildPraiseComment({
      count,
      totalMinutes,
      umeCount,
      takeCount,
      matsuCount,
      fireCount,
      firstTaskName: firstTask?.text,
      fireMinutes: fireMinutes ?? undefined,
      matsuTaskName: matsuTask?.text,
    });
  }, [doneTasks, count, totalMinutes]);

  const handleShare = () => {
    const lines = doneTasks.map((t) => {
      const tier = t.completedTier ? TIER[t.completedTier].label : t.type === 'fire' ? '🔥' : '';
      const min = t.workedMinutes != null ? `(${t.workedMinutes}分)` : '';
      return `✅ [${tier}] ${t.text} ${min}`.trim();
    });
    const msg = [
      `📣 ${praise.headline}`,
      `合計 ${totalMinutes}分 / ${count}個クリア`,
      ...lines,
      '',
      '#タスクブレーキ で過集中にブレーキ',
    ].join('\n');
    void Share.share({ message: msg });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fs.title }]}>本日の褒めログ</Text>
          {count > 0 && (
            <Pressable
              onPress={handleShare}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="結果をシェア">
              <Text style={[styles.shareIcon, { fontSize: fs.body }]}>＜</Text>
            </Pressable>
          )}
        </View>

        {count === 0 ? (
          /* 未クリア時 */
          <View style={styles.empty}>
            <Text style={[styles.emptyEmoji, { fontSize: fs.title * 2 }]}>🌱</Text>
            <Text style={[styles.emptyTitle, { fontSize: fs.body }]}>
              まだ今日のクリアはありません
            </Text>
            <Text style={[styles.emptyBody, { fontSize: fs.small }]}>
              「今日」タブで梅をひとつクリアするだけで、ここに記録されます。{'\n'}
              できなかったことは表示しません。できたことだけ祝います。
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* ヒーローセクション */}
            <View style={styles.hero}>
              <Text style={[styles.heroHeadline, { fontSize: fs.small }]}>
                {praise.headline}
              </Text>
              <View style={styles.heroMinutes}>
                <Text style={[styles.heroMinutesLabel, { fontSize: fs.body }]}>合計</Text>
                <Text style={[styles.heroMinutesNum, { fontSize: fs.title * 2.2 }]}>
                  {' '}{totalMinutes}分
                </Text>
              </View>
              <Text style={[styles.heroSubline, { fontSize: fs.small }]}>
                {praise.subline}
              </Text>
            </View>

            {/* ティアドット */}
            <TierDots tasks={doneTasks} />

            {/* クリアしたタスク一覧 */}
            <Text style={[styles.sectionTitle, { fontSize: fs.small }]}>
              本日クリアした偉業
            </Text>
            <View style={styles.taskList}>
              {doneTasks.map((task) => (
                <DoneRow key={task.id} task={task} />
              ))}
            </View>

            {/* 褒めコメントカード */}
            <View style={styles.commentCard}>
              <Text style={[styles.commentText, { fontSize: fs.body }]}>
                「{praise.comment}」
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgTop },
  container: { flex: 1 },
  containerDesktop: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  shareIcon: {
    color: colors.textSecondary,
    fontWeight: '600',
    transform: [{ scaleX: -1 }],
  },
  // --- Hero ---
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  heroHeadline: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  heroMinutes: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
  },
  heroMinutesLabel: {
    color: colors.text,
    fontWeight: '700',
    paddingBottom: 6,
  },
  heroMinutesNum: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSubline: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // --- Dots ---
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dot: {
    width: 40,
    height: 12,
    borderRadius: radius.pill,
  },
  // --- Task list ---
  sectionTitle: {
    color: colors.textSecondary,
    fontWeight: '600',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  taskList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tierPill: {
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 30,
    alignItems: 'center',
  },
  tierPillTxt: {
    fontWeight: '700',
  },
  rowText: {
    color: colors.text,
    flex: 1,
    fontWeight: '500',
  },
  rowSub: {
    color: colors.textSecondary,
  },
  // --- Comment card ---
  commentCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  commentText: {
    color: colors.text,
    lineHeight: 26,
    textAlign: 'center',
  },
  // --- Scroll ---
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  // --- Empty state ---
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
