import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, gradients, radius, spacing } from '@/theme/tokens';

export type BubbleVariant = 'user' | 'ai' | 'fire';

interface BubbleProps {
  variant: BubbleVariant;
  children: ReactNode;
}

// user=右(青紫グラデ) / ai=左(スレート) / fire=左(赤グラデ)
export function Bubble({ variant, children }: BubbleProps) {
  if (variant === 'user') {
    return (
      <LinearGradient
        colors={gradients.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, styles.right]}>
        {children}
      </LinearGradient>
    );
  }
  if (variant === 'fire') {
    return (
      <LinearGradient
        colors={gradients.fire}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.base, styles.left]}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[styles.base, styles.left, styles.ai]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    maxWidth: '82%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginVertical: spacing.xs,
  },
  right: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: radius.sm,
  },
  left: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: radius.sm,
  },
  ai: {
    backgroundColor: colors.surfaceAlt,
  },
});
