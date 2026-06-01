import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiEstimates, ShojikubaiTier } from '@/types/task';

interface TierOption {
  tier: ShojikubaiTier;
  emoji: string;
  label: string;
  sublabel: string;
  color: string;
  bg: string;
  selectedBg: string;
}

const TIER_OPTIONS: TierOption[] = [
  {
    tier: 'matsu',
    emoji: '🏆',
    label: '松',
    sublabel: 'ベストを尽くす',
    color: '#FFD600',
    bg: 'rgba(255,214,0,0.08)',
    selectedBg: 'rgba(255,214,0,0.2)',
  },
  {
    tier: 'take',
    emoji: '✨',
    label: '竹',
    sublabel: 'いつも通り',
    color: colors.accentTo,
    bg: 'rgba(139,92,246,0.08)',
    selectedBg: 'rgba(139,92,246,0.2)',
  },
  {
    tier: 'ume',
    emoji: '🎉',
    label: '梅',
    sublabel: '最低限だけ',
    color: colors.blue,
    bg: 'rgba(91,141,239,0.08)',
    selectedBg: 'rgba(91,141,239,0.2)',
  },
];

function getDefaultTier(lastCompletedTier: ShojikubaiTier | null): ShojikubaiTier {
  if (lastCompletedTier === 'matsu') return 'take';
  if (lastCompletedTier === 'take') return 'ume';
  return 'matsu';
}

interface Props {
  visible: boolean;
  estimates: ShojikubaiEstimates | null;
  lastCompletedTier: ShojikubaiTier | null;
  workedMinutes: number | null;
  onSelect: (tier: ShojikubaiTier) => void;
  onCancel: () => void;
}

export function TierSelectModal({
  visible,
  estimates,
  lastCompletedTier,
  workedMinutes,
  onSelect,
  onCancel,
}: Props) {
  const { fs } = useLayout();
  const [selected, setSelected] = useState<ShojikubaiTier>(getDefaultTier(lastCompletedTier));

  const handleOpen = () => {
    setSelected(getDefaultTier(lastCompletedTier));
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onShow={handleOpen}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { fontSize: fs.title }]}>どのレベルまで達成しましたか？</Text>
          {workedMinutes != null && (
            <Text style={[styles.worked, { fontSize: fs.small }]}>
              実績: {workedMinutes}分
            </Text>
          )}

          <View style={styles.options}>
            {TIER_OPTIONS.map((opt) => {
              const isSelected = selected === opt.tier;
              const estimate = estimates?.[opt.tier];
              return (
                <Pressable
                  key={opt.tier}
                  onPress={() => setSelected(opt.tier)}
                  style={[
                    styles.option,
                    { backgroundColor: isSelected ? opt.selectedBg : opt.bg },
                    isSelected && { borderColor: opt.color, borderWidth: 1.5 },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}>
                  <View style={styles.optionLeft}>
                    <Text style={[styles.optionEmoji, { fontSize: fs.body }]}>{opt.emoji}</Text>
                    <View>
                      <Text style={[styles.optionLabel, { color: opt.color, fontSize: fs.body }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionSub, { fontSize: fs.caption }]}>
                        {opt.sublabel}
                      </Text>
                    </View>
                  </View>
                  {estimate != null && (
                    <Text style={[styles.estimate, { color: opt.color, fontSize: fs.caption }]}>
                      見積 {estimate}分
                    </Text>
                  )}
                  {isSelected && (
                    <View style={[styles.checkDot, { backgroundColor: opt.color }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.confirmBtn]}
            onPress={() => onSelect(selected)}
            accessibilityRole="button">
            <Text style={[styles.confirmText, { fontSize: fs.body }]}>
              この達成でクリア！
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelBtn}
            onPress={onCancel}
            hitSlop={8}
            accessibilityRole="button">
            <Text style={[styles.cancelText, { fontSize: fs.small }]}>キャンセル</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  worked: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionEmoji: {
    lineHeight: undefined,
  },
  optionLabel: {
    fontWeight: '700',
  },
  optionSub: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  estimate: {
    fontWeight: '600',
    marginRight: spacing.sm,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confirmBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentFrom,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmText: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cancelText: {
    color: colors.textSecondary,
  },
});
