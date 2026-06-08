// 習慣化タスクの GitHub-grass 風ヒートマップ。
// - 上段: 全習慣の集計（こなした件数 + 合計分数で濃さを決める）
// - 下段: 習慣ごとの行（その日の作業分数で濃さを決める）
// 「毎日リセット」仕様に従い、work_sessions の started_at を日付に丸めて集計する。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { listHabitTasks, listTaskIdsByTexts, listDoneBetween } from '@/db/taskRepo';
import { listSessionsForTasksBetween } from '@/db/sessionRepo';
import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

// Web では window.confirm、Native では Alert で確認ダイアログを出す。
function confirmAsync(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  }
  return new Promise((resolve) => {
    Alert.alert('確認', message, [
      { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const WEEKS = 12; // 過去 12 週間（集計ヒートマップ）
const WEEKS_SMALL = 7; // 習慣ごとは 7週×7日 の正方形に圧縮
const DAY_MS = 24 * 60 * 60 * 1000;

// 色スケール（暗背景に映える緑グラデ）
const SCALE_GREEN = [
  'rgba(255,255,255,0.06)',
  '#0E4429',
  '#006D32',
  '#26A641',
  '#39D353',
];

// 集計用（青→紫アクセント）
const SCALE_ACCENT = [
  'rgba(255,255,255,0.06)',
  '#1E2A55',
  '#3B47A8',
  '#5B6EF5',
  '#8B5CF6',
];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// 縦7×横weeks の日付配列。先頭が「weeks週前の日曜日」になるよう正規化。
function buildGrid(weeks: number): number[][] {
  const today = startOfDay(Date.now());
  const todayDate = new Date(today);
  const dow = todayDate.getDay(); // 0=Sun
  // 今週の土曜日 = 今日 + (6 - dow) 日
  const endOfThisWeek = today + (6 - dow) * DAY_MS;
  const start = endOfThisWeek - (weeks * 7 - 1) * DAY_MS;

  const cols: number[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: number[] = [];
    for (let d = 0; d < 7; d++) {
      col.push(start + (w * 7 + d) * DAY_MS);
    }
    cols.push(col);
  }
  return cols;
}

interface DayKey {
  day: number; // startOfDay ms
}

interface AggregateDay {
  count: number; // こなした習慣タスク数
  minutes: number;
}

interface HeatmapData {
  habits: Task[];
  // taskText → dayMs → minutes
  perHabit: Map<string, Map<number, number>>;
  // dayMs → aggregate
  aggregate: Map<number, AggregateDay>;
  // dayMs → grand minutes (for scale)
  maxPerHabit: number;
  maxAggregateScore: number;
}

function aggregateScore(d: AggregateDay): number {
  // 件数を重めに、分数も加算したスコア（色の濃さ決定用）
  return d.count * 15 + d.minutes;
}

function scaleLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  const ratio = value / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// 日曜始まりの週の最初の日(00:00)。
function startOfWeek(ts: number): number {
  const d0 = startOfDay(ts);
  const dow = new Date(d0).getDay();
  return d0 - dow * DAY_MS;
}

// 同じ週の7日分の dayMs 配列を返す。
function weekDays(ts: number): number[] {
  const ws = startOfWeek(ts);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ws + i * DAY_MS);
}

function formatWeekRange(ts: number): string {
  const days = weekDays(ts);
  const a = new Date(days[0]);
  const b = new Date(days[6]);
  return `${a.getMonth() + 1}/${a.getDate()}〜${b.getMonth() + 1}/${b.getDate()}`;
}

export function HabitHeatmap() {
  const { fs } = useLayout();
  const startHabitByText = useTaskStore((s) => s.startHabitByText);
  const renameHabit = useTaskStore((s) => s.renameHabit);
  const deleteHabit = useTaskStore((s) => s.deleteHabit);

  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null); // 開いている操作モーダルの text
  const [editingText, setEditingText] = useState<string | null>(null); // リネーム編集中の元 text
  const [editValue, setEditValue] = useState('');

  const grid = useMemo(() => buildGrid(WEEKS), []);
  const gridSmall = useMemo(() => buildGrid(WEEKS_SMALL), []);
  const rangeStart = grid[0][0];
  const rangeEnd = grid[grid.length - 1][6] + DAY_MS;

  const load = useCallback(async () => {
    const habits = await listHabitTasks();
    const texts = Array.from(new Set(habits.map((t) => t.text)));
    const idMap = await listTaskIdsByTexts(texts);
    const allIds = Array.from(idMap.values()).flat();

    const sessions = await listSessionsForTasksBetween(allIds, rangeStart, rangeEnd);
    const dones = await listDoneBetween(rangeStart, rangeEnd);

    // text 逆引き（id → text）
    const idToText = new Map<string, string>();
    for (const [text, ids] of idMap.entries()) {
      for (const id of ids) idToText.set(id, text);
    }

    const perHabit = new Map<string, Map<number, number>>();
    for (const text of texts) perHabit.set(text, new Map());

    for (const s of sessions) {
      const text = idToText.get(s.taskId);
      if (!text) continue;
      const day = startOfDay(s.startedAt);
      const dayMap = perHabit.get(text)!;
      dayMap.set(day, (dayMap.get(day) ?? 0) + s.minutes);
    }

    const aggregate = new Map<number, AggregateDay>();
    // 件数: その日に完了した習慣化タスク数
    for (const t of dones) {
      if (!t.isHabit || t.completedAt == null) continue;
      const day = startOfDay(t.completedAt);
      const cur = aggregate.get(day) ?? { count: 0, minutes: 0 };
      cur.count += 1;
      aggregate.set(day, cur);
    }
    // 分数: 全習慣のセッション分数
    for (const dayMap of perHabit.values()) {
      for (const [day, mins] of dayMap.entries()) {
        const cur = aggregate.get(day) ?? { count: 0, minutes: 0 };
        cur.minutes += mins;
        aggregate.set(day, cur);
      }
    }

    let maxPerHabit = 0;
    for (const dayMap of perHabit.values()) {
      for (const v of dayMap.values()) {
        if (v > maxPerHabit) maxPerHabit = v;
      }
    }
    let maxAggregateScore = 0;
    for (const d of aggregate.values()) {
      const s = aggregateScore(d);
      if (s > maxAggregateScore) maxAggregateScore = s;
    }

    // 表示は text ユニーク。habits は最新1件ずつ取れている前提。
    setData({ habits, perHabit, aggregate, maxPerHabit, maxAggregateScore });
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStart = useCallback(
    async (text: string) => {
      setActionTarget(null);
      await startHabitByText(text);
      // 完了後にヒートマップも最新化（タスク追加・移動の反映）
      void load();
    },
    [startHabitByText, load]
  );

  const handleOpenEdit = useCallback((text: string) => {
    setActionTarget(null);
    setEditingText(text);
    setEditValue(text);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingText) return;
    const next = editValue.trim();
    if (!next || next === editingText) {
      setEditingText(null);
      return;
    }
    await renameHabit(editingText, next);
    setEditingText(null);
    setSelectedHabit((cur) => (cur === editingText ? next : cur));
    void load();
  }, [editingText, editValue, renameHabit, load]);

  const handleDelete = useCallback(
    async (text: string) => {
      setActionTarget(null);
      const ok = await confirmAsync(
        `「${text}」の履歴とセッションをすべて削除します。元に戻せません。よろしいですか？`
      );
      if (!ok) return;
      await deleteHabit(text);
      setSelectedHabit((cur) => (cur === text ? null : cur));
      void load();
    },
    [deleteHabit, load]
  );

  if (!data) {
    return (
      <View style={styles.loading}>
        <Text style={[styles.dim, { fontSize: fs.small }]}>読み込み中…</Text>
      </View>
    );
  }

  if (data.habits.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { fontSize: fs.body }]}>🌱 まだ習慣化タスクがありません</Text>
        <Text style={[styles.dim, { fontSize: fs.small }]}>
          タスクに「🔁 習慣」を付けると、ここに毎日の頑張りが草として育ちます。
        </Text>
      </View>
    );
  }

  const cellSize = 12;
  const cellGap = 3;
  // 習慣ごと（小グリッド）: 7×7 の正方形に圧縮。1セル 11px → 7×11 + 6×2 = 89px の正方形。
  const smallCellSize = 11;
  const smallCellGap = 2;

  // 月ラベル（各週の最初の日が月初を跨いだら表示）
  const monthLabels: { col: number; label: string }[] = [];
  let prevMonth = -1;
  for (let w = 0; w < grid.length; w++) {
    const firstDayOfWeek = new Date(grid[w][0]);
    const m = firstDayOfWeek.getMonth();
    if (m !== prevMonth) {
      monthLabels.push({ col: w, label: `${m + 1}月` });
      prevMonth = m;
    }
  }

  const selectedAggregate = selectedDay != null ? data.aggregate.get(selectedDay) : null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { fontSize: fs.small }]}>🌱 習慣化の草</Text>

      {/* 集計ヒートマップ */}
      <View style={styles.card}>
        <View style={styles.legendRow}>
          <Text style={[styles.label, { fontSize: fs.caption }]}>全体（件数＋分数）</Text>
          <LegendStrip scale={SCALE_ACCENT} fontSize={fs.caption} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <MonthRow
              labels={monthLabels}
              cellSize={cellSize}
              cellGap={cellGap}
              fontSize={fs.caption}
              weeks={WEEKS}
            />
            <Grid
              grid={grid}
              getValue={(day) => {
                const a = data.aggregate.get(day);
                return a ? aggregateScore(a) : 0;
              }}
              max={data.maxAggregateScore}
              scale={SCALE_ACCENT}
              cellSize={cellSize}
              cellGap={cellGap}
              onPressDay={(day) => {
                setSelectedDay(day);
                setSelectedHabit(null);
              }}
              selectedDay={selectedDay}
            />
          </View>
        </ScrollView>
        {selectedDay != null && (() => {
          // 週合計（日曜〜土曜）
          const week = weekDays(selectedDay);
          let weekCount = 0;
          let weekMinutes = 0;
          for (const d of week) {
            const a = data.aggregate.get(d);
            if (!a) continue;
            weekCount += a.count;
            weekMinutes += a.minutes;
          }
          return (
            <View style={styles.detailBlock}>
              <Text style={[styles.detail, { fontSize: fs.caption }]}>
                {formatFullDay(selectedDay)}: ✅ {selectedAggregate?.count ?? 0}件 / ⏱ {selectedAggregate?.minutes ?? 0}分
              </Text>
              <Text style={[styles.detailSub, { fontSize: fs.caption }]}>
                週合計({formatWeekRange(selectedDay)}): ✅ {weekCount}件 / ⏱ {weekMinutes}分
              </Text>
            </View>
          );
        })()}
      </View>

      {/* タスクごとのヒートマップ（7週×7日の正方形を3列で並べる） */}
      <View style={styles.card}>
        <View style={styles.legendRow}>
          <Text style={[styles.label, { fontSize: fs.caption }]}>習慣ごと（直近7週・作業分数）</Text>
          <LegendStrip scale={SCALE_GREEN} fontSize={fs.caption} />
        </View>
        <View style={styles.habitGridWrap}>
          {data.habits.map((habit) => {
            const dayMap = data.perHabit.get(habit.text);
            return (
              <View key={habit.id} style={styles.habitCard}>
                <View style={styles.habitCardLabelRow}>
                  <Pressable
                    style={styles.habitLabelInner}
                    onPress={() => handleStart(habit.text)}
                    accessibilityRole="button"
                    accessibilityLabel={`「${habit.text}」を始める`}>
                    <Text
                      style={[
                        styles.habitLabel,
                        { fontSize: fs.caption },
                        selectedHabit === habit.text && styles.habitLabelActive,
                      ]}
                      numberOfLines={1}>
                      ▶ {habit.text}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActionTarget(habit.text)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="習慣の編集・削除メニュー">
                    <Text style={[styles.habitMore, { fontSize: fs.caption }]}>⋯</Text>
                  </Pressable>
                </View>
                <Grid
                  grid={gridSmall}
                  getValue={(day) => dayMap?.get(day) ?? 0}
                  max={data.maxPerHabit}
                  scale={SCALE_GREEN}
                  cellSize={smallCellSize}
                  cellGap={smallCellGap}
                  onPressDay={(day) => {
                    setSelectedDay(day);
                    setSelectedHabit(habit.text);
                  }}
                  selectedDay={selectedHabit === habit.text ? selectedDay : null}
                />
              </View>
            );
          })}
        </View>
        {selectedHabit != null && selectedDay != null && (() => {
          const dayMap = data.perHabit.get(selectedHabit);
          const dayMin = dayMap?.get(selectedDay) ?? 0;
          let weekMin = 0;
          for (const d of weekDays(selectedDay)) weekMin += dayMap?.get(d) ?? 0;
          return (
            <View style={styles.detailBlock}>
              <Text style={[styles.detail, { fontSize: fs.caption }]}>
                {selectedHabit} ・ {formatFullDay(selectedDay)}: ⏱ {dayMin}分
              </Text>
              <Text style={[styles.detailSub, { fontSize: fs.caption }]}>
                週合計({formatWeekRange(selectedDay)}): ⏱ {weekMin}分
              </Text>
            </View>
          );
        })()}
      </View>

      {/* 習慣ごとの操作モーダル */}
      <Modal
        transparent
        animationType="fade"
        visible={actionTarget != null}
        onRequestClose={() => setActionTarget(null)}>
        <Pressable style={modalStyles.backdrop} onPress={() => setActionTarget(null)}>
          <Pressable style={modalStyles.sheet} onPress={() => {}}>
            <Text style={[modalStyles.sheetTitle, { fontSize: fs.body }]} numberOfLines={2}>
              {actionTarget}
            </Text>
            <Pressable
              style={modalStyles.row}
              onPress={() => actionTarget && handleStart(actionTarget)}>
              <Text style={[modalStyles.rowText, { fontSize: fs.body }]}>▶ このタスクを始める</Text>
            </Pressable>
            <Pressable
              style={modalStyles.row}
              onPress={() => actionTarget && handleOpenEdit(actionTarget)}>
              <Text style={[modalStyles.rowText, { fontSize: fs.body }]}>✎ 名前を編集</Text>
            </Pressable>
            <Pressable
              style={modalStyles.row}
              onPress={() => actionTarget && handleDelete(actionTarget)}>
              <Text style={[modalStyles.rowText, modalStyles.danger, { fontSize: fs.body }]}>
                🗑 履歴ごと削除
              </Text>
            </Pressable>
            <Pressable
              style={[modalStyles.row, modalStyles.cancel]}
              onPress={() => setActionTarget(null)}>
              <Text style={[modalStyles.rowText, { color: colors.textSecondary, fontSize: fs.body }]}>
                キャンセル
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* リネーム編集モーダル */}
      <Modal
        transparent
        animationType="fade"
        visible={editingText != null}
        onRequestClose={() => setEditingText(null)}>
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.editCard}>
            <Text style={[modalStyles.editTitle, { fontSize: fs.body }]}>習慣の名前を編集</Text>
            <Text style={[modalStyles.editHint, { fontSize: fs.caption }]}>
              同じ名前のタスクを履歴含めてすべてリネームします。
            </Text>
            <TextInput
              style={[modalStyles.editInput, { fontSize: fs.body }]}
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
              multiline
              placeholder="習慣の名前"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={modalStyles.editBtnRow}>
              <Pressable
                style={[modalStyles.editBtn, modalStyles.editCancelBtn]}
                onPress={() => setEditingText(null)}>
                <Text style={[modalStyles.editBtnText, { color: colors.textSecondary, fontSize: fs.small }]}>
                  キャンセル
                </Text>
              </Pressable>
              <Pressable
                style={[modalStyles.editBtn, modalStyles.editSaveBtn]}
                onPress={handleSaveEdit}>
                <Text style={[modalStyles.editBtnText, { color: '#fff', fontSize: fs.small }]}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sheetTitle: {
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    fontWeight: '600',
  },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  cancel: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceAlt,
  },
  rowText: {
    color: colors.text,
    fontWeight: '600',
  },
  danger: {
    color: colors.fireFrom,
  },
  editCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  editTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  editHint: {
    color: colors.textSecondary,
  },
  editInput: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  editCancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  editSaveBtn: {
    backgroundColor: colors.accentFrom,
  },
  editBtnText: {
    fontWeight: '700',
  },
});

function LegendStrip({ scale, fontSize }: { scale: string[]; fontSize: number }) {
  return (
    <View style={styles.legendStrip}>
      <Text style={[styles.dim, { fontSize }]}>少</Text>
      {scale.map((c, i) => (
        <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
      ))}
      <Text style={[styles.dim, { fontSize }]}>多</Text>
    </View>
  );
}

function MonthRow({
  labels,
  cellSize,
  cellGap,
  fontSize,
  weeks,
}: {
  labels: { col: number; label: string }[];
  cellSize: number;
  cellGap: number;
  fontSize: number;
  weeks: number;
}) {
  const colWidth = cellSize + cellGap;
  const totalWidth = weeks * colWidth;
  return (
    <View style={[styles.monthRow, { width: totalWidth }]}>
      {labels.map((l) => (
        <Text
          key={`${l.col}-${l.label}`}
          style={[
            styles.monthLabel,
            { fontSize, left: l.col * colWidth },
          ]}>
          {l.label}
        </Text>
      ))}
    </View>
  );
}

function Grid({
  grid,
  getValue,
  max,
  scale,
  cellSize,
  cellGap,
  onPressDay,
  selectedDay,
}: {
  grid: number[][];
  getValue: (day: number) => number;
  max: number;
  scale: string[];
  cellSize: number;
  cellGap: number;
  onPressDay: (day: number) => void;
  selectedDay: number | null;
}) {
  const today = startOfDay(Date.now());
  return (
    <View style={styles.grid}>
      {grid.map((col, ci) => (
        <View key={ci} style={[styles.col, { marginRight: cellGap }]}>
          {col.map((day) => {
            const value = getValue(day);
            const level = scaleLevel(value, max);
            const isFuture = day > today;
            const isToday = day === today;
            const isSelected = selectedDay === day;
            return (
              <Pressable
                key={day}
                disabled={isFuture}
                onPress={() => onPressDay(day)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    marginBottom: cellGap,
                    backgroundColor: isFuture ? 'transparent' : scale[level],
                    borderWidth: isSelected ? 1.5 : isToday ? 1 : 0,
                    borderColor: isSelected ? colors.text : colors.textSecondary,
                  },
                ]}
                accessibilityLabel={`${formatDay(day)} 値 ${value}`}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  loading: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  legendStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  monthRow: {
    height: 14,
    position: 'relative',
    marginBottom: 2,
  },
  monthLabel: {
    position: 'absolute',
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
  },
  col: {
    flexDirection: 'column',
  },
  cell: {
    borderRadius: 2,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  habitLabelBtn: {
    width: 110,
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  habitMonthOffset: {
    paddingLeft: 110 + spacing.sm,
  },
  // 3列カードレイアウト
  habitGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  habitCard: {
    width: '33.333%',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: 4,
    alignItems: 'center',
  },
  habitCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 4,
  },
  habitLabelInner: {
    flex: 1,
  },
  habitMore: {
    color: colors.textSecondary,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  detailBlock: {
    paddingTop: spacing.xs,
    gap: 2,
  },
  detailSub: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  habitLabel: {
    color: colors.text,
    fontWeight: '500',
  },
  habitLabelActive: {
    color: colors.accentTo,
    fontWeight: '700',
  },
  detail: {
    color: colors.text,
    paddingTop: spacing.xs,
    textAlign: 'center',
  },
  dim: {
    color: colors.textSecondary,
  },
});
