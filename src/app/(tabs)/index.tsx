import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatList } from '@/features/inbox/ChatList';
import { InputBar } from '@/features/inbox/InputBar';
import { useLayout } from '@/hooks/useLayout';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';

export default function InboxScreen() {
  const aiEnabled = useTaskStore((s) => s.aiEnabled);
  const setAiEnabled = useTaskStore((s) => s.setAiEnabled);
  const { fs, isDesktop } = useLayout();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* PC では中央に最大幅 720px のカラムを配置 */}
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fs.title }]}>脳内吐き出し</Text>
          <Pressable
            onPress={() => setAiEnabled(!aiEnabled)}
            style={[styles.aiToggle, aiEnabled ? styles.aiOn : styles.aiOff]}
            accessibilityRole="switch"
            accessibilityState={{ checked: aiEnabled }}>
            <Text
              style={[
                styles.aiText,
                { fontSize: fs.small, color: aiEnabled ? colors.accentTo : colors.textSecondary },
              ]}>
              ✨ AI {aiEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.flex}>
            <ChatList />
          </View>
          <InputBar />
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  containerDesktop: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  aiToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  aiOn: {
    borderColor: colors.accentTo,
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  aiOff: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  aiText: {
    fontWeight: '600',
  },
});
