import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayout } from '@/hooks/useLayout';
import { colors, spacing } from '@/theme/tokens';
import type { ShojikubaiTier } from '@/types/task';

const TIER_COPY: Record<ShojikubaiTier, { emoji: string; title: string; body: string }> = {
  ume: {
    emoji: '🎉',
    title: 'できた！',
    body: '梅クリア！それで十分。着手できた自分をほめよう。',
  },
  take: {
    emoji: '✨',
    title: 'よくできた！',
    body: '竹クリア！いつも通りちゃんとやれた。',
  },
  matsu: {
    emoji: '🏆',
    title: '完璧！',
    body: '松クリア！最高の仕上がり。今日のあなた最強。',
  },
};

interface Props {
  tier: ShojikubaiTier | null;
  taskText: string;
  onClose: () => void;
}

export function DoneOverlay({ tier, taskText, onClose }: Props) {
  const { fs } = useLayout();

  // 梅は3秒後に自動クローズ（最大ポジティブ体験）
  useEffect(() => {
    if (tier === 'ume') {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [tier, onClose]);

  if (!tier) return null;
  const copy = TIER_COPY[tier];

  return (
    <Modal transparent animationType="fade" visible={!!tier}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card}>
          <Text style={[styles.emoji, { fontSize: fs.title * 3 }]}>{copy.emoji}</Text>
          <Text style={[styles.title, { fontSize: fs.title * 1.4 }]}>{copy.title}</Text>
          <Text style={[styles.taskText, { fontSize: fs.body }]}>「{taskText}」</Text>
          <Text style={[styles.body, { fontSize: fs.small }]}>{copy.body}</Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeText, { fontSize: fs.body }]}>次へ</Text>
          </Pressable>
        </View>
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
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    lineHeight: undefined,
  },
  title: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  taskText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  closeBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: colors.accentFrom,
    borderRadius: 999,
  },
  closeText: {
    color: colors.textOnAccent,
    fontWeight: '700',
  },
});
