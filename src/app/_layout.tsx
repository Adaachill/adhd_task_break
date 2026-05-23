import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { getDb } from '@/db';
import { FocusDriftPopup } from '@/features/today/FocusDriftPopup';
import { useFocusDriftDetection } from '@/hooks/useFocusDriftDetection';
import { useTaskStore } from '@/store/taskStore';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const loadInbox = useTaskStore((s) => s.loadInbox);

  const loadToday = useTaskStore((s) => s.loadToday);

  const { driftedTask, dismissDrift } = useFocusDriftDetection();

  useEffect(() => {
    // DB を開いてマイグレーション → 受信トレイ・今日タスク復元
    void getDb().then(() => Promise.all([loadInbox(), loadToday()]));
  }, [loadInbox, loadToday]);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <GradientBackground>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </GradientBackground>
        <FocusDriftPopup task={driftedTask} onDismiss={dismissDrift} />
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgTop,
  },
});
