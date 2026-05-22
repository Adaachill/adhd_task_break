import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

type BadgeTone = 'blue' | 'fire' | 'due' | 'habit' | 'muted';

export interface BadgeOption {
  label: string;
  tone: BadgeTone;
}

interface BadgeSelectorProps {
  label: string;
  tone: BadgeTone;
  options: BadgeOption[];
  fontSize: number;
  /** PC判定（true=クリックでドロップダウン、false=hover or cycle） */
  isDesktop: boolean;
  /** 選択肢を選んだときのコールバック（optionのindex） */
  onSelect: (index: number) => void;
  /** isDesktop=false かつ native 環境でのタップサイクル */
  onCycle: () => void;
}

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

export function BadgeSelector({
  label,
  tone,
  options,
  fontSize,
  isDesktop,
  onSelect,
  onCycle,
}: BadgeSelectorProps) {
  const [open, setOpen] = useState(false);
  const isWeb = Platform.OS === 'web';

  const handlePress = () => {
    if (isDesktop) {
      // PC: クリックでドロップダウンをトグル
      setOpen((v) => !v);
    } else if (isWeb) {
      // モバイルサイズweb: タップでドロップダウンをトグル
      setOpen((v) => !v);
    } else {
      // native: 1タップでサイクル
      onCycle();
    }
  };

  // web のみホバーイベントを付与（モバイルサイズweb）
  const hoverHandlers =
    isWeb && !isDesktop
      ? ({
          onMouseEnter: () => setOpen(true),
          onMouseLeave: () => setOpen(false),
        } as object)
      : {};

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        style={[styles.badge, { backgroundColor: TONE_BG[tone] }]}
        {...hoverHandlers}>
        <Text style={[styles.label, { color: TONE_TEXT[tone], fontSize }]}>{label}</Text>
        {/* PC ではドロップダウン矢印を表示 */}
        {isDesktop && (
          <Text style={[styles.arrow, { color: TONE_TEXT[tone] }]}>{open ? ' ▲' : ' ▼'}</Text>
        )}
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          {options.map((opt, i) => (
            <Pressable
              key={i}
              onPress={() => {
                onSelect(i);
                setOpen(false);
              }}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: pressed ? TONE_BG[opt.tone] : 'transparent' },
              ]}>
              <Text style={[styles.optionText, { color: TONE_TEXT[opt.tone], fontSize }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
  arrow: {
    fontSize: 9,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 120,
    paddingVertical: spacing.xs,
    // web 用シャドウ
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginHorizontal: spacing.xs,
  },
  optionText: {
    fontWeight: '500',
  },
});
