import { StyleSheet, Text, View } from 'react-native';

import type { BadgeOption } from '@/components/ui/BadgeSelector';
import { BadgeSelector } from '@/components/ui/BadgeSelector';
import { Bubble } from '@/components/ui/Bubble';
import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, spacing } from '@/theme/tokens';
import type { DueLabel, Task, TaskType } from '@/types/task';

const DUE_LABEL: Record<DueLabel, string> = {
  today: '今日',
  tomorrow: '明日',
  someday: 'いつか',
};

const TYPE_OPTIONS: (BadgeOption & { value: TaskType | null })[] = [
  { label: '＋ 属性なし', tone: 'muted', value: null },
  { label: '🔵 動ける', tone: 'blue', value: 'blue' },
  { label: '🔥 沼', tone: 'fire', value: 'fire' },
];

const DUE_OPTIONS: (BadgeOption & { value: DueLabel | null })[] = [
  { label: '＋ 期限なし', tone: 'muted', value: null },
  { label: '今日', tone: 'due', value: 'today' },
  { label: '明日', tone: 'due', value: 'tomorrow' },
  { label: 'いつか', tone: 'due', value: 'someday' },
];

const HABIT_OPTIONS: (BadgeOption & { value: boolean })[] = [
  { label: '単発', tone: 'muted', value: false },
  { label: '🔁 習慣', tone: 'habit', value: true },
];

// 1タップ補正のサイクル順
const TYPE_CYCLE: (TaskType | null)[] = [null, 'blue', 'fire'];
const DUE_CYCLE: (DueLabel | null)[] = [null, 'today', 'tomorrow', 'someday'];
const HABIT_CYCLE: boolean[] = [false, true];

function next<T>(cycle: T[], current: T): T {
  const i = cycle.indexOf(current);
  return cycle[(i + 1) % cycle.length];
}

export function TaskBubble({ task }: { task: Task }) {
  const update = useTaskStore((s) => s.updateClassification);
  const { isDesktop, fs } = useLayout();

  const onCycleType = () => update(task.id, { type: next(TYPE_CYCLE, task.type) });
  const onCycleDue = () => update(task.id, { due: next(DUE_CYCLE, task.due) });
  const onCycleHabit = () => update(task.id, { isHabit: next(HABIT_CYCLE, task.isHabit) });

  const typeBadge =
    task.type === 'fire'
      ? { label: '🔥 沼', tone: 'fire' as const }
      : task.type === 'blue'
        ? { label: '🔵 動ける', tone: 'blue' as const }
        : { label: '＋ 属性', tone: 'muted' as const };

  const dueBadge = task.due
    ? { label: DUE_LABEL[task.due], tone: 'due' as const }
    : { label: '＋ 期限', tone: 'muted' as const };

  const habitBadge = task.isHabit
    ? { label: '🔁 習慣', tone: 'habit' as const }
    : { label: '単発', tone: 'muted' as const };

  return (
    <View style={styles.row}>
      {/* ユーザーの吐き出し（右・青紫） */}
      <Bubble variant="user">
        <Text style={[styles.userText, { fontSize: fs.body }]}>{task.text}</Text>
      </Bubble>

      {/* 分類カード（左・🔥は赤 / それ以外はスレート） */}
      <Bubble variant={task.type === 'fire' ? 'fire' : 'ai'}>
        <Text style={[styles.cardHint, { fontSize: fs.caption }]}>
          {task.classifySource === 'unclassified'
            ? isDesktop
              ? 'バッジをクリックして仕分け'
              : 'バッジをタップして仕分け'
            : task.classifySource === 'ai'
              ? isDesktop
                ? 'AIが仕分けました（クリックで修正）'
                : 'AIが仕分けました（タップで修正）'
              : '手動で仕分け済み'}
        </Text>
        <View style={styles.badges}>
          <BadgeSelector
            label={typeBadge.label}
            tone={typeBadge.tone}
            options={TYPE_OPTIONS}
            fontSize={fs.caption}
            isDesktop={isDesktop}
            onSelect={(i) => update(task.id, { type: TYPE_OPTIONS[i]?.value ?? null })}
            onCycle={onCycleType}
          />
          <BadgeSelector
            label={dueBadge.label}
            tone={dueBadge.tone}
            options={DUE_OPTIONS}
            fontSize={fs.caption}
            isDesktop={isDesktop}
            onSelect={(i) => update(task.id, { due: DUE_OPTIONS[i]?.value ?? null })}
            onCycle={onCycleDue}
          />
          <BadgeSelector
            label={habitBadge.label}
            tone={habitBadge.tone}
            options={HABIT_OPTIONS}
            fontSize={fs.caption}
            isDesktop={isDesktop}
            onSelect={(i) => update(task.id, { isHabit: HABIT_OPTIONS[i]?.value ?? false })}
            onCycle={onCycleHabit}
          />
        </View>
      </Bubble>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: spacing.xs,
  },
  userText: {
    color: colors.textOnAccent,
  },
  cardHint: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    // ドロップダウンが上に重なるよう zIndex を確保
    zIndex: 1,
  },
});
