import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ShojikubaiTier } from '@/types/task';

interface TierConfig {
  tier: ShojikubaiTier;
  label: string;
  sublabel: string;
  bg: string;
  color: string;
}

const TIERS: TierConfig[] = [
  {
    tier: 'ume',
    label: '梅',
    sublabel: '最低限だけ',
    bg: 'rgba(91,141,239,0.15)',
    color: colors.blue,
  },
  {
    tier: 'take',
    label: '竹',
    sublabel: 'いつも通り',
    bg: 'rgba(139,92,246,0.15)',
    color: colors.accentTo,
  },
  {
    tier: 'matsu',
    label: '松',
    sublabel: 'ベストを尽くす',
    bg: 'rgba(255,214,0,0.12)',
    color: '#FFD600',
  },
];

interface Props {
  onSelect: (tier: ShojikubaiTier) => void;
}

export function ShojikubaiButtons({ onSelect }: Props) {
  const { fs } = useLayout();

  return (
    <View style={styles.row}>
      {TIERS.map((t) => (
        <Pressable
          key={t.tier}
          onPress={() => onSelect(t.tier)}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: t.bg, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t.label}で完了`}>
          <Text style={[styles.tier, { color: t.color, fontSize: fs.title }]}>{t.label}</Text>
          <Text style={[styles.sub, { color: t.color, fontSize: fs.caption }]}>{t.sublabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tier: {
    fontWeight: '800',
  },
  sub: {
    fontWeight: '500',
    opacity: 0.85,
  },
});
