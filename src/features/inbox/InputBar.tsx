import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function InputBar() {
  const [text, setText] = useState('');
  const addTask = useTaskStore((s) => s.addTask);

  const canSend = text.trim().length > 0;

  const onSend = async () => {
    if (!canSend) return;
    const value = text;
    setText('');
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await addTask(value);
  };

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="タスクを書き留める…"
        placeholderTextColor={colors.textSecondary}
        multiline
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
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.body,
  },
});
