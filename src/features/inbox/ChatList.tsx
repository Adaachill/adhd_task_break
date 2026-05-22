import { useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

import { TaskBubble } from './TaskBubble';

export function ChatList() {
  const tasks = useTaskStore((s) => s.tasks);
  const listRef = useRef<FlatList<Task>>(null);
  const { fs } = useLayout();

  if (tasks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { fontSize: fs.title }]}>考える前に、まず吐き出す</Text>
        <Text style={[styles.emptyBody, { fontSize: fs.small }]}>
          頭に浮かんだことを、順番を気にせずどんどん投げ込んでください。{'\n'}
          AIが🔵/🔥と期限を自動で仕分けします。
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={tasks}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => <TaskBubble task={item} />}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
