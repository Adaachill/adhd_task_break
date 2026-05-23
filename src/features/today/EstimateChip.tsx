import { StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { useEstimatingIds } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

interface Props {
  task: Task;
}

function bars(level: number | null): string {
  if (!level) return '─────';
  const n = Math.max(1, Math.min(5, level));
  return '▓'.repeat(n) + '░'.repeat(5 - n);
}

/**
 * 🔵 タスク用 AI 見積もりチップ（PR-B）。
 * - 推定中: 「⚡ 見積もり中…」
 * - 取得済: 「⚡ 約 25分 / 難易度 ▓▓▓░░ / 抵抗感 ▓▓▓▓░」+ rationale
 * - AI 無効 or 失敗: 何も表示しない
 */
export function EstimateChip({ task }: Props) {
  const { fs } = useLayout();
  const isEstimating = useEstimatingIds((s) => s.ids.has(task.id));

  if (isEstimating) {
    return (
      <View style={styles.chipLoading}>
        <Text style={[styles.loadingTxt, { fontSize: fs.small }]}>⚡ 見積もり中…</Text>
      </View>
    );
  }

  if (task.estimatedMinutes === null) return null;

  return (
    <View style={styles.chip}>
      <Text style={[styles.headline, { fontSize: fs.small }]}>
        ⚡ AI見積もり：約 {task.estimatedMinutes}分
      </Text>
      <View style={styles.metaRow}>
        <Text style={[styles.meta, { fontSize: fs.caption }]}>
          難易度 {bars(task.estimatedDifficulty)}
        </Text>
        <Text style={[styles.meta, { fontSize: fs.caption }]}>
          抵抗感 {bars(task.estimatedResistance)}
        </Text>
      </View>
      {task.estimateRationale ? (
        <Text style={[styles.rationale, { fontSize: fs.caption }]} numberOfLines={2}>
          {task.estimateRationale}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(91,141,239,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(91,141,239,0.30)',
    gap: 4,
  },
  chipLoading: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  loadingTxt: {
    color: colors.textSecondary,
  },
  headline: {
    color: colors.blue,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  meta: {
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  rationale: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
