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
  // 早期に「止める＝完了」した際の実測分数を親へ通知
  onComplete: (workedMinutes: number) => void;
  // タイマーを止めてタスクを中断（完了ではない）
  onPause: () => void;
}

// タイマー開始からの経過分数（最低1分）
function elapsedMinutes(startedAt: number | null): number {
  if (!startedAt) return 0;
  return Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
}

export function BrakeTimer({ task, onTimeUp, onComplete, onPause }: Props) {
  const startBrakeTimer = useTaskStore((s) => s.startBrakeTimer);
  const { fs } = useLayout();

  const isRunning = task.timerStartedAt !== null;
  const { isExpired, formatted, remainingMs } = useCountdown(task.timerStartedAt, task.timerMinutes);

  const totalMs = (task.timerMinutes ?? 0) * 60_000;
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const elapsedSec = Math.floor((elapsedMs % 60_000) / 1000);
  const elapsedFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;

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

  // 「終わった！」= 早期完了。通知をキャンセルし、実測分数を親に渡す
  const handleStop = async () => {
    const notifId = notifMap.get(task.id);
    if (notifId) {
      await cancelNotification(notifId);
      notifMap.delete(task.id);
    }
    onComplete(elapsedMinutes(task.timerStartedAt));
  };

  // 「中断」= タイマーを止めてタスクを today に残す（完了ではない）
  const handlePause = async () => {
    const notifId = notifMap.get(task.id);
    if (notifId) {
      await cancelNotification(notifId);
      notifMap.delete(task.id);
    }
    onPause();
  };

  if (isRunning) {
    return (
      <View style={styles.running}>
        <Text style={[styles.countdown, { fontSize: fs.title * 1.8, color: isExpired ? colors.fireFrom : colors.text }]}>
          {isExpired ? 'TIME UP' : formatted}
        </Text>
        {!isExpired && (
          <View style={styles.timeRow}>
            <View style={styles.timeCell}>
              <Text style={[styles.timeCellValue, { fontSize: fs.body, color: colors.fireFrom }]}>
                {elapsedFormatted}
              </Text>
              <Text style={[styles.timeCellLabel, { fontSize: fs.caption }]}>経過</Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeCell}>
              <Text style={[styles.timeCellValue, { fontSize: fs.body, color: colors.text }]}>
                {formatted}
              </Text>
              <Text style={[styles.timeCellLabel, { fontSize: fs.caption }]}>残り（{task.timerMinutes}分設定）</Text>
            </View>
          </View>
        )}
        {isExpired && (
          <Text style={[styles.label, { fontSize: fs.caption }]}>時間になりました！</Text>
        )}
        {!isExpired && (
          <View style={styles.actionRow}>
            <Pressable onPress={handleStop} style={styles.stopBtn}>
              <Text style={[styles.stopText, { fontSize: fs.small }]}>✋ 終わった！</Text>
            </Pressable>
            <Pressable onPress={handlePause} style={styles.pauseBtn}>
              <Text style={[styles.pauseText, { fontSize: fs.small }]}>⏸ 中断</Text>
            </Pressable>
          </View>
        )}
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  timeCell: {
    alignItems: 'center',
    gap: 2,
  },
  timeCellValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timeCellLabel: {
    color: colors.textSecondary,
  },
  timeDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stopBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  stopText: {
    color: colors.text,
    fontWeight: '600',
  },
  pauseBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pauseText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
