import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet } from 'react-native';

import { colors, gradients } from '@/theme/tokens';

interface IconButtonProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  filled?: boolean; // true: アクセントグラデの円形ボタン
  accessibilityLabel?: string;
}

export function IconButton({
  name,
  onPress,
  disabled = false,
  size = 22,
  filled = false,
  accessibilityLabel,
}: IconButtonProps) {
  const icon = (
    <Ionicons name={name} size={size} color={filled ? colors.textOnAccent : colors.textSecondary} />
  );

  if (filled) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{ opacity: disabled ? 0.4 : 1 }}>
        <LinearGradient colors={gradients.accent} style={styles.circle}>
          {icon}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.plain, { opacity: disabled ? 0.4 : 1 }]}>
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
