import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function PickerItem({ task, onPick }: { task: Task; onPick: () => void }) {
  const { fs } = useLayout();
  const isFire = task.type === 'fire';
  const isBlue = task.type === 'blue';

  return (
    <Pressable
      onPress={onPick}
      style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.tag, { fontSize: fs.caption, color: isFire ? colors.fireFrom : isBlue ? colors.blue : colors.textSecondary }]}>
        {isFire ? '🔥' : isBlue ? '🔵' : '　'}
      </Text>
      <Text style={[styles.itemText, { fontSize: fs.body }]} numberOfLines={2}>
        {task.text}
      </Text>
    </Pressable>
  );
}

export function TaskPickerModal({ visible, onClose }: Props) {
  const tasks = useTaskStore((s) => s.tasks); // inbox
  const moveToToday = useTaskStore((s) => s.moveToToday);
  const { fs } = useLayout();

  const handlePick = async (task: Task) => {
    await moveToToday(task.id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: fs.title }]}>タスクを選ぶ</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeTxt, { fontSize: fs.body }]}>閉じる</Text>
            </Pressable>
          </View>

          {tasks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTxt, { fontSize: fs.body }]}>
                吐き出しタブにタスクを追加してください
              </Text>
            </View>
          ) : (
            <FlatList
              data={tasks}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <PickerItem task={item} onPick={() => handlePick(item)} />
              )}
              contentContainerStyle={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  closeBtn: { padding: spacing.xs },
  closeTxt: { color: colors.accentTo, fontWeight: '600' },
  list: { padding: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  tag: { fontWeight: '700', width: 20, textAlign: 'center' },
  itemText: { flex: 1, color: colors.text },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyTxt: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
