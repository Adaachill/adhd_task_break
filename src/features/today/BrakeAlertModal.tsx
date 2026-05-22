import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  taskText: string;
  visible: boolean;
  onExtend: () => void; // 15分延長
  onStop: () => void;   // 強制終了
}

export function BrakeAlertModal({ taskText, visible, onExtend, onStop }: Props) {
  const { fs } = useLayout();

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={[styles.icon, { fontSize: fs.title * 2.5 }]}>⏱</Text>
          <Text style={[styles.title, { fontSize: fs.title }]}>ブレーキ！</Text>
          <Text style={[styles.body, { fontSize: fs.body }]}>
            「{taskText}」の時間になりました。{'\n'}いったん手を止めましょう。
          </Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={onExtend}
              style={({ pressed }) => [styles.extendBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.extendText, { fontSize: fs.small }]}>⏱ 15分延長</Text>
            </Pressable>
            <Pressable
              onPress={onStop}
              style={({ pressed }) => [styles.stopBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={[styles.stopText, { fontSize: fs.body }]}>✋ 強制終了して休憩</Text>
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
    justifyContent: 'flex-end',
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
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
    color: colors.fireFrom,
    fontWeight: '800',
  },
  body: {
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  buttons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  extendBtn: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  extendText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stopBtn: {
    paddingVertical: spacing.md,
    borderRadius: 999,
    backgroundColor: 'rgba(255,90,110,0.18)',
    alignItems: 'center',
  },
  stopText: {
    color: colors.fireFrom,
    fontWeight: '700',
  },
});
