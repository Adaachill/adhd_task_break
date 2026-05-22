import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useCountdown } from '@/hooks/useCountdown';
import { cancelNotification, scheduleBrakeNotification } from '@/services/notifications';
import { notifMap, useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

interface Props {
  task: Task;
  onTimeUp: () => void;
}

export function BrakeTimer({ task, onTimeUp }: Props) {
  const startBrakeTimer = useTaskStore((s) => s.startBrakeTimer);
  const stopBrakeTimer = useTaskStore((s) => s.stopBrakeTimer);
  const { fs } = useLayout();

  const isRunning = task.timerStartedAt !== null;
  const { isExpired, formatted } = useCountdown(task.timerStartedAt, task.timerMinutes);

  // タイムアップ検知
  useEffect(() => {
    if (isExpired && isRunning) {
      onTimeUp();
    }
  }, [isExpired, isRunning, onTimeUp]);

  const handleStart = async (minutes: number) => {
    const endTime = Date.now() + minutes * 60_000;
    const notifId = await scheduleBrakeNotification(task.text, endTime);
    await startBrakeTimer(task.id, minutes, notifId ?? undefined);
  };

  const handleStop = async () => {
    const notifId = notifMap.get(task.id);
    if (notifId) {
      await cancelNotification(notifId);
      notifMap.delete(task.id);
    }
    await stopBrakeTimer(task.id);
  };

  if (isRunning) {
    return (
      <View style={styles.running}>
        <Text style={[styles.countdown, { fontSize: fs.title * 1.8, color: isExpired ? colors.fireFrom : colors.text }]}>
          {isExpired ? 'TIME UP' : formatted}
        </Text>
        <Text style={[styles.label, { fontSize: fs.caption }]}>
          {isExpired ? '時間になりました！' : `残り時間（${task.timerMinutes}分設定）`}
        </Text>
        <Pressable onPress={handleStop} style={styles.stopBtn}>
          <Text style={[styles.stopText, { fontSize: fs.small }]}>✋ 止める</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.setup}>
      <Text style={[styles.label, { fontSize: fs.caption }]}>制限時間を選択（必須）</Text>
      <View style={styles.durationRow}>
        {DURATION_OPTIONS.map((min) => (
          <Pressable
            key={min}
            onPress={() => handleStart(min)}
            style={({ pressed }) => [
              styles.durationBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${min}分でブレーキ開始`}>
            <Text style={[styles.durationText, { fontSize: fs.small }]}>{min}分</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  setup: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  running: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
  },
  countdown: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,90,110,0.15)',
  },
  durationText: {
    color: colors.fireFrom,
    fontWeight: '600',
  },
  stopBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stopText: {
    color: colors.text,
    fontWeight: '600',
  },
});
