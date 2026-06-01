import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { BadgeOption } from '@/components/ui/BadgeSelector';
import { BadgeSelector } from '@/components/ui/BadgeSelector';
import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { DueLabel, ShojikubaiDef, ShojikubaiEstimates, ShojikubaiTier, Task, TaskType } from '@/types/task';

import { BrakeAlertModal } from './BrakeAlertModal';
import { BrakeTimer } from './BrakeTimer';
import { DoneOverlay } from './DoneOverlay';
import { EstimateChip } from './EstimateChip';
import { ShojikubaiEditor } from './ShojikubaiEditor';
import { StartTaskButton } from './StartTaskButton';
import { TierSelectModal } from './TierSelectModal';

interface Props {
  task: Task;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const MATSU_COLOR = '#FFD600';
const TAKE_COLOR = colors.accentTo;
const UME_COLOR = colors.blue;

const TYPE_OPTIONS: (BadgeOption & { value: TaskType })[] = [
  { label: '🔵 TODO', tone: 'blue', value: 'blue' },
  { label: '🔥 沼', tone: 'fire', value: 'fire' },
];

const DUE_LABEL: Record<DueLabel, string> = {
  today: '今日',
  tomorrow: '明日',
  someday: 'いつか',
};

const DUE_OPTIONS: (BadgeOption & { value: DueLabel })[] = [
  { label: '今日', tone: 'due', value: 'today' },
  { label: '明日', tone: 'due', value: 'tomorrow' },
  { label: 'いつか', tone: 'due', value: 'someday' },
];

const HABIT_OPTIONS: (BadgeOption & { value: boolean })[] = [
  { label: '単発', tone: 'muted', value: false },
  { label: '🔁 習慣', tone: 'habit', value: true },
];

const TYPE_CYCLE: TaskType[] = ['blue', 'fire'];
const DUE_CYCLE: DueLabel[] = ['today', 'tomorrow', 'someday'];

function cycleNext<T>(cycle: T[], current: T): T {
  const i = cycle.indexOf(current);
  return cycle[(i + 1) % cycle.length];
}

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
  const updateShojikubai = useTaskStore((s) => s.updateShojikubai);
  const moveToInbox = useTaskStore((s) => s.moveToInbox);
  const updateShojikubaiEstimates = useTaskStore((s) => s.updateShojikubaiEstimates);
  const updateTodayTask = useTaskStore((s) => s.updateTodayTask);
  const doneTasks = useTaskStore((s) => s.doneTasks);
  const { fs, isDesktop } = useLayout();

  const [doneTier, setDoneTier] = useState<ShojikubaiTier | null>(null);
  const [fireDone, setFireDone] = useState(false);
  const [brakeAlert, setBrakeAlert] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);

  // 編集モード：タイトル
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(task.text);
  useEffect(() => {
    setTitleText(task.text);
  }, [task.text]);

  // 編集：見積もり分数
  const [estimateText, setEstimateText] = useState(
    task.estimatedMinutes != null ? String(task.estimatedMinutes) : ''
  );
  useEffect(() => {
    setEstimateText(task.estimatedMinutes != null ? String(task.estimatedMinutes) : '');
  }, [task.estimatedMinutes]);

  const commitTitle = () => {
    const next = titleText.trim();
    setEditingTitle(false);
    if (!next || next === task.text) {
      setTitleText(task.text);
      return;
    }
    void updateTodayTask(task.id, { text: next });
  };

  const commitEstimate = () => {
    const mins = parseInt(estimateText, 10);
    if (!isNaN(mins) && mins > 0) {
      void updateTodayTask(task.id, { estimatedMinutes: mins, estimateSource: 'manual' });
    } else if (estimateText === '') {
      void updateTodayTask(task.id, { estimatedMinutes: null, estimateSource: null });
    }
  };

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

  const handleFirePause = async () => {
    await stopBrakeTimer(task.id);
  };

  const handleSaveShojikubai = (def: ShojikubaiDef) => {
    void updateShojikubai(task.id, def);
  };

  const handleEstimatesChange = (estimates: ShojikubaiEstimates) => {
    void updateShojikubaiEstimates(task.id, estimates);
  };

  const currentEstimates: ShojikubaiEstimates = task.shojikubaiEstimates ?? {
    matsu: null,
    take: null,
    ume: null,
  };

  // 実績分数（モーダル表示用）: 積算済み分 + 現セグメント分
  const workedMinutes = (() => {
    const accumulated = task.workedMinutes ?? 0;
    const currentSegment = task.blueStartedAt != null
      ? Math.max(0, Math.round((Date.now() - task.blueStartedAt) / 60_000))
      : 0;
    const total = accumulated + currentSegment;
    return total > 0 ? total : null;
  })();

  const isFire = task.type === 'fire';
  const isBlue = task.type === 'blue';
  const borderColor = isFire ? colors.fireFrom : isBlue ? colors.blue : colors.border;
  const timerRunning = task.timerStartedAt != null;

  const typeBadge: BadgeOption = isFire
    ? { label: '🔥 沼', tone: 'fire' }
    : { label: '🔵 TODO', tone: 'blue' };
  const dueBadge: BadgeOption = task.due
    ? { label: DUE_LABEL[task.due], tone: 'due' }
    : { label: '＋ 期限', tone: 'muted' };
  const habitBadge: BadgeOption = task.isHabit
    ? { label: '🔁 習慣', tone: 'habit' }
    : { label: '単発', tone: 'muted' };

  return (
    <>
      <View style={[styles.card, { borderColor }]}>
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <BadgeSelector
              label={typeBadge.label}
              tone={typeBadge.tone}
              options={TYPE_OPTIONS}
              fontSize={fs.caption}
              isDesktop={isDesktop}
              onSelect={(i) =>
                updateTodayTask(task.id, { type: TYPE_OPTIONS[i]?.value ?? 'blue' })
              }
              onCycle={() =>
                updateTodayTask(task.id, {
                  type: cycleNext(TYPE_CYCLE, (task.type ?? 'blue') as TaskType),
                })
              }
            />
            <BadgeSelector
              label={dueBadge.label}
              tone={dueBadge.tone}
              options={DUE_OPTIONS}
              fontSize={fs.caption}
              isDesktop={isDesktop}
              onSelect={(i) =>
                updateTodayTask(task.id, { due: DUE_OPTIONS[i]?.value ?? 'today' })
              }
              onCycle={() =>
                updateTodayTask(task.id, {
                  due: cycleNext(DUE_CYCLE, (task.due ?? 'today') as DueLabel),
                })
              }
            />
            <BadgeSelector
              label={habitBadge.label}
              tone={habitBadge.tone}
              options={HABIT_OPTIONS}
              fontSize={fs.caption}
              isDesktop={isDesktop}
              onSelect={(i) =>
                updateTodayTask(task.id, { isHabit: HABIT_OPTIONS[i]?.value ?? false })
              }
              onCycle={() => updateTodayTask(task.id, { isHabit: !task.isHabit })}
            />
          </View>
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

        {editingTitle ? (
          <TextInput
            style={[styles.text, styles.textInput, { fontSize: fs.body }]}
            value={titleText}
            onChangeText={setTitleText}
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            autoFocus
            returnKeyType="done"
            multiline
            accessibilityLabel="タスク名を編集"
          />
        ) : (
          <Pressable onPress={() => setEditingTitle(true)} accessibilityRole="button">
            <Text style={[styles.text, { fontSize: fs.body }]}>{task.text}</Text>
          </Pressable>
        )}

        {/* 見積もり分数の編集 */}
        <View style={styles.estimateRow}>
          <Text style={[styles.estimateLabel, { fontSize: fs.caption }]}>⏱ 見積もり</Text>
          <TextInput
            style={[styles.estimateInput, { fontSize: fs.caption }]}
            value={estimateText}
            onChangeText={setEstimateText}
            onBlur={commitEstimate}
            onSubmitEditing={commitEstimate}
            placeholder="分"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            returnKeyType="done"
            editable={!timerRunning}
            accessibilityLabel="見積もり分数"
          />
          <Text style={[styles.estimateLabel, { fontSize: fs.caption }]}>分</Text>
        </View>

        {/* 🔵: AI見積もり + 松竹梅内容入力 + 見積もり時間 + 🚀始める + 完了 */}
        {isBlue && (
          <>
            <EstimateChip task={task} />
            <ShojikubaiEditor value={task.shojikubai} onSave={handleSaveShojikubai} />
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
          <BrakeTimer
            task={task}
            onTimeUp={handleTimeUp}
            onComplete={handleFireComplete}
            onPause={handleFirePause}
          />
        )}

        {/* 属性なしタスク: 完了ボタン */}
        {!isBlue && !isFire && (
          <Pressable style={styles.doneBtn} onPress={() => handleSelectTier('take')}>
            <Text style={[styles.doneTxt, { fontSize: fs.body }]}>完了</Text>
          </Pressable>
        )}
      </View>

      {doneTier && (
        <DoneOverlay tier={doneTier} taskText={task.text} onClose={handleDoneClose} />
      )}

      {fireDone && !doneTier && (
        <DoneOverlay tier="take" taskText={task.text} onClose={handleDoneClose} />
      )}

      <BrakeAlertModal
        taskText={task.text}
        visible={brakeAlert}
        onExtend={handleExtend}
        onStop={handleForceStop}
      />

      <TierSelectModal
        visible={showTierModal}
        shojikubai={task.shojikubai}
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
    zIndex: 2,
  },
  textInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accentFrom,
    paddingVertical: 2,
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  estimateLabel: {
    color: colors.textSecondary,
  },
  estimateInput: {
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.textSecondary,
    paddingVertical: 2,
    minWidth: 50,
    textAlign: 'center',
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
