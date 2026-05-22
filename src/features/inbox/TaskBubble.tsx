import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Bubble } from '@/components/ui/Bubble';
import { useTaskStore } from '@/store/taskStore';
import { colors, spacing, typography } from '@/theme/tokens';
import type { DueLabel, Task, TaskType } from '@/types/task';

const DUE_LABEL: Record<DueLabel, string> = {
  today: '今日',
  tomorrow: '明日',
  someday: 'いつか',
};

// 1タップ補正のサイクル順
const TYPE_CYCLE: (TaskType | null)[] = [null, 'blue', 'fire'];
const DUE_CYCLE: (DueLabel | null)[] = [null, 'today', 'tomorrow', 'someday'];

function next<T>(cycle: T[], current: T): T {
  const i = cycle.indexOf(current);
  return cycle[(i + 1) % cycle.length];
}

export function TaskBubble({ task }: { task: Task }) {
  const update = useTaskStore((s) => s.updateClassification);

  const onCycleType = () => update(task.id, { type: next(TYPE_CYCLE, task.type) });
  const onCycleDue = () => update(task.id, { due: next(DUE_CYCLE, task.due) });
  const onToggleHabit = () => update(task.id, { isHabit: !task.isHabit });

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
        <Text style={styles.userText}>{task.text}</Text>
      </Bubble>

      {/* 分類カード（左・🔥は赤 / それ以外はスレート） */}
      <Bubble variant={task.type === 'fire' ? 'fire' : 'ai'}>
        <Text style={styles.cardHint}>
          {task.classifySource === 'unclassified'
            ? 'バッジをタップして仕分け'
            : task.classifySource === 'ai'
              ? 'AIが仕分けました（タップで修正）'
              : '手動で仕分け済み'}
        </Text>
        <View style={styles.badges}>
          <Badge label={typeBadge.label} tone={typeBadge.tone} onPress={onCycleType} />
          <Badge label={dueBadge.label} tone={dueBadge.tone} onPress={onCycleDue} />
          <Badge label={habitBadge.label} tone={habitBadge.tone} onPress={onToggleHabit} />
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
    fontSize: typography.body,
  },
  cardHint: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    marginBottom: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
