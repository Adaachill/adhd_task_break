import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

interface Props {
  tasks: Task[];
  emptySlots: number;
  onSelectMore: () => void;
}

function SuggestCard({ task, onSelect }: { task: Task; onSelect: () => void }) {
  const { fs } = useLayout();
  const isFire = task.type === 'fire';
  const isBlue = task.type === 'blue';
  const typeColor = isFire ? colors.fireFrom : isBlue ? colors.blue : colors.textSecondary;
  const typeIcon = isFire ? '🔥' : isBlue ? '🔵' : '○';
  const isToday = task.due === 'today';
  const dueLabelMap: Record<string, string> = { today: '今日', tomorrow: '明日', someday: 'いつか' };
  const dueLabel = task.due ? dueLabelMap[task.due] : null;

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.75 : 1 }]}>
      <View style={styles.cardTop}>
        <Text style={[styles.typeIcon, { color: typeColor, fontSize: fs.caption }]}>
          {typeIcon}
        </Text>
        {dueLabel && (
          <View style={[styles.dueBadge, isToday && styles.dueBadgeToday]}>
            <Text
              style={[
                styles.dueText,
                { fontSize: fs.caption - 1, color: isToday ? colors.fireFrom : colors.textSecondary },
              ]}>
              {dueLabel}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.taskText, { fontSize: fs.small }]} numberOfLines={3}>
        {task.text}
      </Text>
      <View style={styles.addRow}>
        <Text style={[styles.addText, { fontSize: fs.caption }]}>＋ 追加</Text>
      </View>
    </Pressable>
  );
}

export function TaskSuggestRow({ tasks, emptySlots, onSelectMore }: Props) {
  const moveToToday = useTaskStore((s) => s.moveToToday);
  const { fs } = useLayout();

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const aDue = a.due === 'today' ? 0 : 1;
        const bDue = b.due === 'today' ? 0 : 1;
        if (aDue !== bDue) return aDue - bDue;
        return a.createdAt - b.createdAt;
      }),
    [tasks]
  );

  const slotLabel = emptySlots === 1 ? 'あと1枠追加できます' : `あと${emptySlots}枠追加できます`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, { fontSize: fs.small }]}>{slotLabel}</Text>
        <Pressable onPress={onSelectMore} hitSlop={8}>
          <Text style={[styles.moreText, { fontSize: fs.caption }]}>すべて見る</Text>
        </Pressable>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { fontSize: fs.small }]}>
            吐き出しタブにタスクを追加してください
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={sorted}
          keyExtractor={(t) => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SuggestCard task={item} onSelect={() => moveToToday(item.id)} />
          )}
        />
      )}
    </View>
  );
}

const CARD_WIDTH = 148;

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  moreText: {
    color: colors.accentTo,
    fontWeight: '600',
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeIcon: {
    fontWeight: '700',
  },
  dueBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dueBadgeToday: {
    backgroundColor: 'rgba(255,90,110,0.15)',
  },
  dueText: {
    fontWeight: '600',
  },
  taskText: {
    color: colors.text,
    lineHeight: 18,
    flex: 1,
  },
  addRow: {
    marginTop: spacing.xs,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(91,110,245,0.15)',
  },
  addText: {
    color: colors.accentFrom,
    fontWeight: '700',
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
