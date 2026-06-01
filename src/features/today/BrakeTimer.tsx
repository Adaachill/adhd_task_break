import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  // 中断/完了時の作業目標の達成可否を親に通知して褒めるアクションを起動
  onGoalCheck?: (achieved: boolean, goal: string) => void;
}

// タイマー開始からの経過分数（最低1分）
function elapsedMinutes(startedAt: number | null): number {
  if (!startedAt) return 0;
  return Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
}

export function BrakeTimer({ task, onTimeUp, onComplete, onPause, onGoalCheck }: Props) {
  const startBrakeTimer = useTaskStore((s) => s.startBrakeTimer);
  const { fs } = useLayout();

  const isRunning = task.timerStartedAt !== null;
  const { isExpired, formatted, remainingMs } = useCountdown(task.timerStartedAt, task.timerMinutes);

  const totalMs = (task.timerMinutes ?? 0) * 60_000;
  const elapsedMs = Math.max(0, totalMs - remainingMs);
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const elapsedSec = Math.floor((elapsedMs % 60_000) / 1000);
  const elapsedFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSec).padStart(2, '0')}`;

  // 開始前: 作業目標入力モーダル
  const [pendingMinutes, setPendingMinutes] = useState<number | null>(null);
  const [goalText, setGoalText] = useState('');

  // 中断/完了時: 目標達成確認モーダル
  const [goalCheckMode, setGoalCheckMode] = useState<'pause' | 'complete' | null>(null);
  const [pendingWorkedMinutes, setPendingWorkedMinutes] = useState<number>(0);

  // タイムアップ検知
  useEffect(() => {
    if (isExpired && isRunning) {
      onTimeUp();
    }
  }, [isExpired, isRunning, onTimeUp]);

  const openGoalInput = (minutes: number) => {
    setPendingMinutes(minutes);
    setGoalText('');
  };

  const confirmGoalAndStart = async () => {
    if (pendingMinutes == null) return;
    const goal = goalText.trim();
    if (!goal) return;
    const minutes = pendingMinutes;
    setPendingMinutes(null);
    const endTime = Date.now() + minutes * 60_000;
    const notifId = await scheduleBrakeNotification(task.text, endTime);
    await startBrakeTimer(task.id, minutes, goal, notifId ?? undefined);
  };

  const cancelGoalInput = () => {
    setPendingMinutes(null);
    setGoalText('');
  };

  // 「終わった！」= 早期完了。通知をキャンセル → 目標達成確認 → 完了
  const handleStop = async () => {
    const notifId = notifMap.get(task.id);
    if (notifId) {
      await cancelNotification(notifId);
      notifMap.delete(task.id);
    }
    const worked = elapsedMinutes(task.timerStartedAt);
    if (task.timerGoal) {
      setPendingWorkedMinutes(worked);
      setGoalCheckMode('complete');
    } else {
      onComplete(worked);
    }
  };

  // 「中断」= タイマーを止めてタスクを today に残す（経過分は workedMinutes に積算済み）
  const handlePause = async () => {
    const notifId = notifMap.get(task.id);
    if (notifId) {
      await cancelNotification(notifId);
      notifMap.delete(task.id);
    }
    if (task.timerGoal) {
      setPendingWorkedMinutes(elapsedMinutes(task.timerStartedAt));
      setGoalCheckMode('pause');
    } else {
      onPause();
    }
  };

  const handleGoalAnswer = (achieved: boolean) => {
    const mode = goalCheckMode;
    const goal = task.timerGoal ?? '';
    setGoalCheckMode(null);
    if (achieved && onGoalCheck) onGoalCheck(true, goal);
    if (mode === 'complete') {
      onComplete(pendingWorkedMinutes);
    } else if (mode === 'pause') {
      onPause();
    }
  };

  if (isRunning) {
    return (
      <View style={styles.running}>
        {task.timerGoal && (
          <View style={styles.goalChip}>
            <Text style={[styles.goalChipLabel, { fontSize: fs.caption }]}>🎯 目標</Text>
            <Text style={[styles.goalChipText, { fontSize: fs.caption }]} numberOfLines={2}>
              {task.timerGoal}
            </Text>
          </View>
        )}
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

        <GoalCheckModal
          visible={goalCheckMode !== null}
          goal={task.timerGoal ?? ''}
          workedMinutes={pendingWorkedMinutes}
          onAnswer={handleGoalAnswer}
        />
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
            onPress={() => openGoalInput(min)}
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

      <GoalInputModal
        visible={pendingMinutes !== null}
        minutes={pendingMinutes ?? 0}
        value={goalText}
        onChange={setGoalText}
        onConfirm={confirmGoalAndStart}
        onCancel={cancelGoalInput}
      />
    </View>
  );
}

interface GoalInputModalProps {
  visible: boolean;
  minutes: number;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function GoalInputModal({ visible, minutes, value, onChange, onConfirm, onCancel }: GoalInputModalProps) {
  const { fs } = useLayout();
  const canConfirm = value.trim().length > 0;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={[styles.modalTitle, { fontSize: fs.title }]}>🎯 作業目標</Text>
          <Text style={[styles.modalBody, { fontSize: fs.small }]}>
            {minutes}分で「どこまでやりたい？」{'\n'}
            ゴールを宣言すると、達成したときにちゃんと自分を褒められます。
          </Text>
          <TextInput
            style={[styles.goalInput, { fontSize: fs.body }]}
            value={value}
            onChangeText={onChange}
            placeholder="例: イントロの章を書き終える"
            placeholderTextColor={colors.textSecondary}
            autoFocus
            multiline
            returnKeyType="done"
          />
          <View style={styles.modalButtons}>
            <Pressable onPress={onCancel} style={[styles.modalBtn, styles.modalBtnSecondary]}>
              <Text style={[styles.modalBtnTextSecondary, { fontSize: fs.small }]}>キャンセル</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={!canConfirm}
              style={[styles.modalBtn, styles.modalBtnPrimary, { opacity: canConfirm ? 1 : 0.4 }]}>
              <Text style={[styles.modalBtnTextPrimary, { fontSize: fs.small }]}>{minutes}分で開始 →</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface GoalCheckModalProps {
  visible: boolean;
  goal: string;
  workedMinutes: number;
  onAnswer: (achieved: boolean) => void;
}

function GoalCheckModal({ visible, goal, workedMinutes, onAnswer }: GoalCheckModalProps) {
  const { fs } = useLayout();
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={[styles.modalTitle, { fontSize: fs.title }]}>🎯 目標は達成できた？</Text>
          <View style={styles.goalRecap}>
            <Text style={[styles.goalRecapLabel, { fontSize: fs.caption }]}>あなたの目標</Text>
            <Text style={[styles.goalRecapText, { fontSize: fs.body }]}>「{goal}」</Text>
            <Text style={[styles.modalBody, { fontSize: fs.small }]}>
              {workedMinutes}分作業しました
            </Text>
          </View>
          <View style={styles.modalButtons}>
            <Pressable onPress={() => onAnswer(false)} style={[styles.modalBtn, styles.modalBtnSecondary]}>
              <Text style={[styles.modalBtnTextSecondary, { fontSize: fs.small }]}>まだ途中</Text>
            </Pressable>
            <Pressable onPress={() => onAnswer(true)} style={[styles.modalBtn, styles.modalBtnPrimary]}>
              <Text style={[styles.modalBtnTextPrimary, { fontSize: fs.small }]}>達成できた！</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    maxWidth: '100%',
  },
  goalChipLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  goalChipText: {
    color: colors.text,
    fontWeight: '500',
    flexShrink: 1,
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
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  goalInput: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  goalRecap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  goalRecapLabel: {
    color: colors.textSecondary,
  },
  goalRecapText: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: colors.fireFrom,
  },
  modalBtnTextPrimary: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBtnSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnTextSecondary: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
