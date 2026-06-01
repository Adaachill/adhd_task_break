import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiEstimates, ShojikubaiTier, Task } from '@/types/task';

import { BrakeAlertModal } from './BrakeAlertModal';
import { BrakeTimer } from './BrakeTimer';
import { DoneOverlay } from './DoneOverlay';
import { EstimateChip } from './EstimateChip';
import { StartTaskButton } from './StartTaskButton';
import { TierSelectModal } from './TierSelectModal';

interface Props {
  task: Task;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// 松の色
const MATSU_COLOR = '#FFD600';
const TAKE_COLOR = colors.accentTo;
const UME_COLOR = colors.blue;

function getLastCompletedTier(doneTasks: Task[], taskText: string): ShojikubaiTier | null {
  const match = doneTasks.find((t) => t.text === taskText && t.completedTier != null);
  return match?.completedTier ?? null;
}

interface TierEstimateRowProps {
  estimates: ShojikubaiEstimates;
  onChange: (estimates: ShojikubaiEstimates) => void;
}

function TierEstimateRow({ estimates, onChange }: TierEstimateRowProps) {
  const { fs } = useLayout();
  const [matsuText, setMatsuText] = useState(estimates.matsu != null ? String(estimates.matsu) : '');
  const [takeText, setTakeText] = useState(estimates.take != null ? String(estimates.take) : '');
  const [umeText, setUmeText] = useState(estimates.ume != null ? String(estimates.ume) : '');

  const commit = (matsu: string, take: string, ume: string) => {
    const parse = (s: string) => {
      const n = parseInt(s, 10);
      return isNaN(n) || n <= 0 ? null : n;
    };
    onChange({ matsu: parse(matsu), take: parse(take), ume: parse(ume) });
  };

  return (
    <View style={tierStyles.row}>
      <Text style={[tierStyles.rowLabel, { fontSize: fs.caption }]}>⏱ 松竹梅の見積もり</Text>
      <View style={tierStyles.inputs}>
        {/* 松: 必須 */}
        <View style={tierStyles.inputGroup}>
          <Text style={[tierStyles.tierLabel, { color: MATSU_COLOR, fontSize: fs.caption }]}>
            松＊
          </Text>
          <TextInput
            style={[tierStyles.input, tierStyles.inputRequired, { fontSize: fs.caption }]}
            value={matsuText}
            onChangeText={setMatsuText}
            onBlur={() => commit(matsuText, takeText, umeText)}
            onSubmitEditing={() => commit(matsuText, takeText, umeText)}
            placeholder="分"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            returnKeyType="done"
            accessibilityLabel="松の見積もり（必須）"
          />
        </View>
        {/* 竹: 任意 */}
        <View style={tierStyles.inputGroup}>
          <Text style={[tierStyles.tierLabel, { color: TAKE_COLOR, fontSize: fs.caption }]}>
            竹
          </Text>
          <TextInput
            style={[tierStyles.input, { fontSize: fs.caption }]}
            value={takeText}
            onChangeText={setTakeText}
            onBlur={() => commit(matsuText, takeText, umeText)}
            onSubmitEditing={() => commit(matsuText, takeText, umeText)}
            placeholder="分"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            returnKeyType="done"
            accessibilityLabel="竹の見積もり（任意）"
          />
        </View>
        {/* 梅: 任意 */}
        <View style={tierStyles.inputGroup}>
          <Text style={[tierStyles.tierLabel, { color: UME_COLOR, fontSize: fs.caption }]}>
            梅
          </Text>
          <TextInput
            style={[tierStyles.input, { fontSize: fs.caption }]}
            value={umeText}
            onChangeText={setUmeText}
            onBlur={() => commit(matsuText, takeText, umeText)}
            onSubmitEditing={() => commit(matsuText, takeText, umeText)}
            placeholder="分"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            returnKeyType="done"
            accessibilityLabel="梅の見積もり（任意）"
          />
        </View>
      </View>
    </View>
  );
}

const tierStyles = StyleSheet.create({
  row: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  rowLabel: {
    color: colors.textSecondary,
  },
  inputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tierLabel: {
    fontWeight: '700',
  },
  input: {
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.textSecondary,
    paddingVertical: 2,
    width: 44,
    textAlign: 'center',
  },
  inputRequired: {
    borderBottomColor: MATSU_COLOR,
  },
});

export function TodayTaskCard({ task, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: Props) {
  const completeShojikubai = useTaskStore((s) => s.completeShojikubai);
  const completeFireTask = useTaskStore((s) => s.completeFireTask);
  const startBrakeTimer = useTaskStore((s) => s.startBrakeTimer);
  const stopBrakeTimer = useTaskStore((s) => s.stopBrakeTimer);
  const moveToInbox = useTaskStore((s) => s.moveToInbox);
  const updateShojikubaiEstimates = useTaskStore((s) => s.updateShojikubaiEstimates);
  const doneTasks = useTaskStore((s) => s.doneTasks);
  const { fs } = useLayout();

  const [doneTier, setDoneTier] = useState<ShojikubaiTier | null>(null);
  const [fireDone, setFireDone] = useState(false);
  const [brakeAlert, setBrakeAlert] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);

  const lastCompletedTier = getLastCompletedTier(doneTasks, task.text);

  const handleSelectTier = async (tier: ShojikubaiTier) => {
    setShowTierModal(false);
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
    await stopBrakeTimer(task.id);
    await startBrakeTimer(task.id, 15);
  };

  const handleFireComplete = async (workedMinutes: number) => {
    setFireDone(true);
    await completeFireTask(task.id, workedMinutes);
  };

  const handleForceStop = async () => {
    setBrakeAlert(false);
    setFireDone(true);
    await completeFireTask(task.id, task.timerMinutes ?? 0);
  };

  const handleEstimatesChange = (estimates: ShojikubaiEstimates) => {
    void updateShojikubaiEstimates(task.id, estimates);
  };

  const currentEstimates: ShojikubaiEstimates = task.shojikubaiEstimates ?? {
    matsu: null,
    take: null,
    ume: null,
  };

  // 実績分数（モーダル表示用）
  const workedMinutes =
    task.blueStartedAt != null
      ? Math.max(1, Math.round((Date.now() - task.blueStartedAt) / 60_000))
      : null;

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

        {/* 🔵: AI 見積もり + 松竹梅見積もり入力 + 🚀 始める + 完了ボタン */}
        {isBlue && (
          <>
            <EstimateChip task={task} />
            <TierEstimateRow
              estimates={currentEstimates}
              onChange={handleEstimatesChange}
            />
            <StartTaskButton task={task} />
            <Pressable
              style={styles.doneBtn}
              onPress={() => setShowTierModal(true)}
              accessibilityRole="button">
              <Text style={[styles.doneTxt, { fontSize: fs.body }]}>完了 →</Text>
            </Pressable>
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

      {/* 松竹梅選択モーダル */}
      <TierSelectModal
        visible={showTierModal}
        estimates={task.shojikubaiEstimates}
        lastCompletedTier={lastCompletedTier}
        workedMinutes={workedMinutes}
        onSelect={handleSelectTier}
        onCancel={() => setShowTierModal(false)}
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
