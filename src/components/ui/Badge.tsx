import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type BadgeTone = 'blue' | 'fire' | 'due' | 'habit' | 'muted';

const TONE_BG: Record<BadgeTone, string> = {
  blue: 'rgba(91,141,239,0.18)',
  fire: 'rgba(255,90,110,0.18)',
  due: 'rgba(139,92,246,0.18)',
  habit: 'rgba(61,214,140,0.18)',
  muted: 'rgba(255,255,255,0.06)',
};

const TONE_TEXT: Record<BadgeTone, string> = {
  blue: colors.blue,
  fire: colors.fireFrom,
  due: colors.accentTo,
  habit: colors.success,
  muted: colors.textSecondary,
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  onPress?: () => void;
}

export function Badge({ label, tone = 'muted', onPress }: BadgeProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.badge, { backgroundColor: TONE_BG[tone] }]}>
      <Text style={[styles.label, { color: TONE_TEXT[tone] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
  },
});
