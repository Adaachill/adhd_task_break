import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { gradients } from '@/theme/tokens';

export function GradientBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={gradients.bg} style={StyleSheet.absoluteFill}>
      {children}
    </LinearGradient>
  );
}
