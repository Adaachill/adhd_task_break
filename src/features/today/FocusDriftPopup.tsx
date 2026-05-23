import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

interface Props {
  task: Task | null;
  onDismiss: () => void;
}

export function FocusDriftPopup({ task, onDismiss }: Props) {
  const { fs } = useLayout();
  const stopBrakeTimer = useTaskStore((s) => s.stopBrakeTimer);

  const handleStop = async () => {
    if (task) await stopBrakeTimer(task.id);
    onDismiss();
  };

  return (
    <Modal transparent animationType="fade" visible={!!task} onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[styles.icon, { fontSize: fs.title * 2 }]}>👀</Text>
          <Text style={[styles.title, { fontSize: fs.title }]}>戻ってきましたね</Text>
          <Text style={[styles.body, { fontSize: fs.body }]}>
            「{task?.text}」の作業中でした。{'\n'}関連ありましたか？
          </Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.continueBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.continueText, { fontSize: fs.body }]}>
                ✋ そのまま続ける
              </Text>
            </Pressable>
            <Pressable
              onPress={handleStop}
              style={({ pressed }) => [styles.stopBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.stopText, { fontSize: fs.small }]}>
                作業を中断する
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  icon: {},
  title: {
    color: colors.text,
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  buttons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  continueBtn: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: 'rgba(91,141,239,0.18)',
    alignItems: 'center',
  },
  continueText: {
    color: colors.blue,
    fontWeight: '700',
  },
  stopBtn: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  stopText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
