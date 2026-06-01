import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

interface Props {
  task: Task;
}

function useElapsed(startedAt: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * 🔵 タスク用の「🚀 始める」「⏸ 中断」ボタン。
 * - 未開始／中断中：「🚀 始める」を表示
 * - 開始済：経過時間 + 「⏸ 中断」ボタンを表示
 */
export function StartTaskButton({ task }: Props) {
  const { fs } = useLayout();
  const startBlueTask = useTaskStore((s) => s.startBlueTask);
  const pauseBlueTask = useTaskStore((s) => s.pauseBlueTask);
  const elapsed = useElapsed(task.blueStartedAt);

  if (task.blueStartedAt !== null) {
    return (
      <View style={styles.runningRow}>
        <View style={styles.runningPill}>
          <View style={styles.dot} />
          <Text style={[styles.runningTxt, { fontSize: fs.small }]}>
            作業中 {elapsed}
          </Text>
        </View>
        <Pressable
          onPress={() => void pauseBlueTask(task.id)}
          style={({ pressed }) => [styles.pauseBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.pauseTxt, { fontSize: fs.small }]}>⏸ 中断</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void startBlueTask(task.id)}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.btnTxt, { fontSize: fs.body }]}>
        {task.continued === false ? '🚀 再開' : '🚀 始める'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(91,141,239,0.22)',
    alignItems: 'center',
  },
  btnTxt: {
    color: colors.blue,
    fontWeight: '700',
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  runningPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: 'rgba(91,141,239,0.10)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue,
  },
  runningTxt: {
    color: colors.blue,
    fontWeight: '700',
  },
  pauseBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pauseTxt: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
