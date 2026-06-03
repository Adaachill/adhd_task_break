import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { searchSimilarTasks } from '@/db/taskRepo';
import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

export function InputBar() {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Task[]>([]);
  const addTask = useTaskStore((s) => s.addTask);
  const { fs, isDesktop } = useLayout();

  const canSend = text.trim().length > 0;
  const trimmed = useMemo(() => text.trim(), [text]);

  // 過去タスク検索（debounce 250ms、2文字以上）
  useEffect(() => {
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchSimilarTasks(trimmed, 5).then((res) => {
        if (cancelled) return;
        // 完全一致は提案する意味がないため除外
        setSuggestions(res.filter((r) => r.text !== trimmed));
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const onSend = async () => {
    if (!canSend) return;
    const value = text;
    setText('');
    setSuggestions([]);
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await addTask(value);
  };

  // 候補タップ：入力欄に反映してユーザが編集できるようにする（即時登録ではない）
  const onSuggestionPress = (suggestion: Task) => {
    setText(suggestion.text);
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
  };

  return (
    <View>
      {suggestions.length > 0 && (
        <View style={styles.suggestWrap}>
          <Text style={[styles.suggestLabel, { fontSize: fs.caption }]}>
            🔁 過去の似たタスク
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestRow}>
            {suggestions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onSuggestionPress(s)}
                style={({ pressed }) => [styles.suggestChip, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`類似タスク: ${s.text}`}>
                <Text style={[styles.suggestText, { fontSize: fs.caption }]} numberOfLines={1}>
                  {s.text}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={[styles.bar, isDesktop && styles.barDesktop]}>
        <TextInput
          style={[styles.input, { fontSize: fs.body }]}
          value={text}
          onChangeText={setText}
          placeholder="タスクを書き留める…"
          placeholderTextColor={colors.textSecondary}
          multiline={!isDesktop}
          onSubmitEditing={onSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <IconButton
          name="arrow-up"
          filled
          disabled={!canSend}
          onPress={onSend}
          accessibilityLabel="送信"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  barDesktop: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  suggestWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  suggestLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  suggestRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  suggestChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 240,
  },
  suggestText: {
    color: colors.text,
    fontWeight: '500',
  },
});
