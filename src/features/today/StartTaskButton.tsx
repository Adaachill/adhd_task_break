import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

interface Props {
  task: Task;
}

// 🚀 始める押下後の経過分:秒を返す簡易フック
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
 * 🔵 タスク用の「🚀 始める」ボタン（PR-A 計測ループ）。
 * - 未開始：押下で `blueStartedAt` を記録し、取り掛かりラグ（`timeToStartSeconds`）も保存
 * - 開始済：経過時間 mm:ss を表示
 * - 押下せず直接松竹梅タップも可能（その場合 workedMinutes は null のまま）
 */
export function StartTaskButton({ task }: Props) {
  const { fs } = useLayout();
  const startBlueTask = useTaskStore((s) => s.startBlueTask);
  const elapsed = useElapsed(task.blueStartedAt);

  if (task.blueStartedAt !== null) {
    return (
      <View style={styles.runningPill}>
        <View style={styles.dot} />
        <Text style={[styles.runningTxt, { fontSize: fs.small }]}>
          作業中 {elapsed}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => void startBlueTask(task.id)}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.7 : 1 }]}>
      <Text style={[styles.btnTxt, { fontSize: fs.body }]}>🚀 始める</Text>
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
  runningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
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
});
