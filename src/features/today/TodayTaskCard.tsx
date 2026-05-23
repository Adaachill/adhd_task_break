import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiTier, Task } from '@/types/task';

import { BrakeAlertModal } from './BrakeAlertModal';
import { BrakeTimer } from './BrakeTimer';
import { DoneOverlay } from './DoneOverlay';
import { EstimateChip } from './EstimateChip';
import { ShojikubaiButtons } from './ShojikubaiButtons';
import { StartTaskButton } from './StartTaskButton';

interface Props {
  task: Task;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function TodayTaskCard({ task, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: Props) {
  const completeShojikubai = useTaskStore((s) => s.completeShojikubai);
  const completeFireTask = useTaskStore((s) => s.completeFireTask);
  const startBrakeTimer = useTaskStore((s) => s.startBrakeTimer);
  const stopBrakeTimer = useTaskStore((s) => s.stopBrakeTimer);
  const moveToInbox = useTaskStore((s) => s.moveToInbox);
  const { fs } = useLayout();

  const [doneTier, setDoneTier] = useState<ShojikubaiTier | null>(null);
  const [fireDone, setFireDone] = useState(false);
  const [brakeAlert, setBrakeAlert] = useState(false);

  const handleSelectTier = async (tier: ShojikubaiTier) => {
    setDoneTier(tier);
    await completeShojikubai(task.id, tier);
  };

  const handleDoneClose = () => {
    setDoneTier(null);
    setFireDone(false);
  };

  const handleTimeUp = useCallback(() => {
    setBrakeAlert(true);
  }, []);

  const handleExtend = async () => {
    setBrakeAlert(false);
    // 15分延長：現在のタイマーを停止して新しく15分で開始
    await stopBrakeTimer(task.id);
    await startBrakeTimer(task.id, 15);
  };

  // 🔥 早期に「終わった！」→ 実測分数で完了
  const handleFireComplete = async (workedMinutes: number) => {
    setFireDone(true);
    await completeFireTask(task.id, workedMinutes);
  };

  // タイムアップ後「強制終了して休憩」→ 設定分をフルで動けたとして完了
  const handleForceStop = async () => {
    setBrakeAlert(false);
    setFireDone(true);
    await completeFireTask(task.id, task.timerMinutes ?? 0);
  };

  const isFire = task.type === 'fire';
  const isBlue = task.type === 'blue';
  const borderColor = isFire ? colors.fireFrom : isBlue ? colors.blue : colors.border;

  return (
    <>
      <View style={[styles.card, { borderColor }]}>
        {/* タスクテキスト */}
        <View style={styles.header}>
          <Text style={[styles.typeTag, { fontSize: fs.caption, color: isFire ? colors.fireFrom : colors.blue }]}>
            {isFire ? '🔥 沼タスク' : isBlue ? '🔵 動けるタスク' : 'タスク'}
          </Text>
          {/* 並び替え + 今日から外す */}
          <View style={styles.headerActions}>
            {(canMoveUp || canMoveDown) && (
              <View style={styles.reorderBtns}>
                <Pressable
                  onPress={onMoveUp}
                  disabled={!canMoveUp}
                  style={styles.reorderBtn}
                  hitSlop={6}>
                  <Text style={[styles.reorderTxt, { fontSize: fs.caption, opacity: canMoveUp ? 1 : 0.2 }]}>
                    ↑
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onMoveDown}
                  disabled={!canMoveDown}
                  style={styles.reorderBtn}
                  hitSlop={6}>
                  <Text style={[styles.reorderTxt, { fontSize: fs.caption, opacity: canMoveDown ? 1 : 0.2 }]}>
                    ↓
                  </Text>
                </Pressable>
              </View>
            )}
            <Pressable onPress={() => moveToInbox(task.id)} style={styles.removeBtn}>
              <Text style={[styles.removeTxt, { fontSize: fs.caption }]}>✕</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.text, { fontSize: fs.body }]}>{task.text}</Text>

        {/* 🔵: AI 見積もり + 🚀 始める + 松竹梅ボタン */}
        {isBlue && (
          <>
            <EstimateChip task={task} />
            <StartTaskButton task={task} />
            <ShojikubaiButtons onSelect={handleSelectTier} />
          </>
        )}

        {/* 🔥: ブレーキタイマー */}
        {isFire && (
          <BrakeTimer task={task} onTimeUp={handleTimeUp} onComplete={handleFireComplete} />
        )}

        {/* 属性なしタスク: 完了ボタン */}
        {!isBlue && !isFire && (
          <Pressable style={styles.doneBtn} onPress={() => handleSelectTier('take')}>
            <Text style={[styles.doneTxt, { fontSize: fs.body }]}>完了</Text>
          </Pressable>
        )}
      </View>

      {/* 松竹梅達成オーバーレイ */}
      {doneTier && (
        <DoneOverlay tier={doneTier} taskText={task.text} onClose={handleDoneClose} />
      )}

      {/* 🔥 完了オーバーレイ（竹相当の演出） */}
      {fireDone && !doneTier && (
        <DoneOverlay tier="take" taskText={task.text} onClose={handleDoneClose} />
      )}

      {/* ブレーキ警告モーダル */}
      <BrakeAlertModal
        taskText={task.text}
        visible={brakeAlert}
        onExtend={handleExtend}
        onStop={handleForceStop}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  typeTag: {
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reorderBtns: {
    flexDirection: 'row',
    gap: 2,
  },
  reorderBtn: {
    padding: spacing.xs,
  },
  reorderTxt: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  removeBtn: {
    padding: spacing.xs,
  },
  removeTxt: {
    color: colors.textSecondary,
  },
  text: {
    color: colors.text,
    fontWeight: '600',
    lineHeight: 24,
  },
  doneBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(91,110,245,0.18)',
    alignItems: 'center',
  },
  doneTxt: {
    color: colors.accentFrom,
    fontWeight: '700',
  },
});
