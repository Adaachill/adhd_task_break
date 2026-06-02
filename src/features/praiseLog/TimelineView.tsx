import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiTier, Task } from '@/types/task';

const TIER_COLOR: Record<ShojikubaiTier, string> = {
  ume: '#3DD68C',
  take: '#FF8A4C',
  matsu: '#FFD600',
};
const FIRE_COLOR = colors.fireFrom;
const BLUE_COLOR = colors.blue;

const HOUR_HEIGHT = 44;
const HOURS_TOTAL = 24;
const TIMELINE_HEIGHT = HOUR_HEIGHT * HOURS_TOTAL;
const HOUR_LABEL_WIDTH = 44;
const MIN_BLOCK_HEIGHT = 18;

interface Segment {
  taskId: string;
  text: string;
  color: string;
  label: string;
  startMin: number; // minutes from 0:00 of the day
  durationMin: number;
}

// 日の開始時刻（ローカル）
function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// タスクごとの開始時間を取り出す（将来複数開始に対応するため配列を返す）
function getStartTimes(task: Task): number[] {
  const starts: number[] = [];
  if (task.type === 'fire' && task.timerStartedAt != null) {
    starts.push(task.timerStartedAt);
  } else if (task.blueStartedAt != null) {
    starts.push(task.blueStartedAt);
  } else if (task.completedAt != null && task.workedMinutes != null) {
    // フォールバック: 完了時刻 - 作業時間
    starts.push(task.completedAt - task.workedMinutes * 60_000);
  } else if (task.completedAt != null) {
    starts.push(task.completedAt);
  }
  return starts;
}

function tierColor(task: Task): { color: string; label: string } {
  if (task.completedTier) {
    return { color: TIER_COLOR[task.completedTier], label: task.completedTier === 'ume' ? '梅' : task.completedTier === 'take' ? '竹' : '松' };
  }
  if (task.type === 'fire') return { color: FIRE_COLOR, label: '🔥' };
  return { color: BLUE_COLOR, label: '🔵' };
}

// タスクから当日にマップされるセグメントを生成
// 複数の開始時間があれば、workedMinutes を均等分割する
function taskToSegments(task: Task, dayStart: number, dayEnd: number): Segment[] {
  const worked = task.workedMinutes ?? 0;
  if (worked <= 0) return [];
  const starts = getStartTimes(task);
  if (starts.length === 0) return [];

  const each = worked / starts.length;
  const { color, label } = tierColor(task);

  const segs: Segment[] = [];
  for (const startMs of starts) {
    const endMs = startMs + each * 60_000;
    // 当日範囲にクランプ
    const s = Math.max(startMs, dayStart);
    const e = Math.min(endMs, dayEnd);
    if (e <= s) continue;
    const startMin = Math.floor((s - dayStart) / 60_000);
    const durationMin = Math.max(1, Math.round((e - s) / 60_000));
    segs.push({
      taskId: task.id,
      text: task.text,
      color,
      label,
      startMin,
      durationMin,
    });
  }
  return segs;
}

function formatHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface TimelineViewProps {
  tasks: Task[];
  dayStartMs?: number;
}

export function TimelineView({ tasks, dayStartMs }: TimelineViewProps) {
  const { fs } = useLayout();

  const dayStart = dayStartMs ?? startOfDay(Date.now());
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const segments = useMemo(() => {
    const list: Segment[] = [];
    for (const t of tasks) {
      list.push(...taskToSegments(t, dayStart, dayEnd));
    }
    return list;
  }, [tasks, dayStart, dayEnd]);

  const totalMinutes = useMemo(
    () => tasks.reduce((sum, t) => sum + (t.workedMinutes ?? 0), 0),
    [tasks]
  );
  const count = tasks.length;

  const hours = Array.from({ length: HOURS_TOTAL }, (_, i) => i);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      {/* サマリ */}
      <View style={styles.summary}>
        <View style={styles.summaryCell}>
          <Text style={[styles.summaryNum, { fontSize: fs.title * 1.5 }]}>{count}</Text>
          <Text style={[styles.summaryLabel, { fontSize: fs.caption }]}>クリア数</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCell}>
          <Text style={[styles.summaryNum, { fontSize: fs.title * 1.5 }]}>{totalMinutes}</Text>
          <Text style={[styles.summaryLabel, { fontSize: fs.caption }]}>合計 分</Text>
        </View>
      </View>

      {/* 24時間タイムライン */}
      <View style={styles.timelineWrap}>
        <View style={[styles.timeline, { height: TIMELINE_HEIGHT }]}>
          {/* 時刻ラベル + 罫線 */}
          {hours.map((h) => (
            <View key={h} style={[styles.hourRow, { top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }]}>
              <Text style={[styles.hourLabel, { fontSize: fs.caption }]}>
                {String(h).padStart(2, '0')}:00
              </Text>
              <View style={styles.hourLine} />
            </View>
          ))}

          {/* タスクブロック */}
          <View style={styles.blockLayer} pointerEvents="box-none">
            {segments.map((seg, idx) => {
              const top = (seg.startMin / 60) * HOUR_HEIGHT;
              const height = Math.max(
                MIN_BLOCK_HEIGHT,
                (seg.durationMin / 60) * HOUR_HEIGHT
              );
              return (
                <View
                  key={`${seg.taskId}-${idx}`}
                  style={[
                    styles.block,
                    {
                      top,
                      height,
                      backgroundColor: seg.color + '33', // 20% opacity
                      borderLeftColor: seg.color,
                    },
                  ]}>
                  <Text
                    style={[styles.blockTime, { fontSize: fs.caption, color: seg.color }]}
                    numberOfLines={1}>
                    {seg.label} {formatHHMM(seg.startMin)}–{formatHHMM(seg.startMin + seg.durationMin)} ({seg.durationMin}分)
                  </Text>
                  <Text
                    style={[styles.blockText, { fontSize: fs.small }]}
                    numberOfLines={2}>
                    {seg.text}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {segments.length === 0 && (
        <Text style={[styles.emptyHint, { fontSize: fs.small }]}>
          まだ今日のクリアはありません
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  summary: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  summaryNum: {
    color: colors.text,
    fontWeight: '800',
    letterSpacing: -1,
  },
  summaryLabel: {
    color: colors.textSecondary,
  },
  timelineWrap: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  timeline: {
    position: 'relative',
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: HOUR_LABEL_WIDTH,
    color: colors.textSecondary,
    paddingTop: 0,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginTop: 6,
  },
  blockLayer: {
    position: 'absolute',
    left: HOUR_LABEL_WIDTH + spacing.xs,
    right: 0,
    top: 0,
    bottom: 0,
  },
  block: {
    position: 'absolute',
    left: 0,
    right: spacing.xs,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  blockTime: {
    fontWeight: '700',
  },
  blockText: {
    color: colors.text,
    marginTop: 2,
  },
  emptyHint: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingTop: spacing.xl,
  },
});
