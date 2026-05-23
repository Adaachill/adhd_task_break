import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { getDb } from '@/db';
import { FocusDriftPopup } from '@/features/today/FocusDriftPopup';
import { useFocusDriftDetection } from '@/hooks/useFocusDriftDetection';
import { useTaskStore } from '@/store/taskStore';
import { colors } from '@/theme/tokens';

// react-native-screens は web ではデフォルト無効（isNativePlatformSupported=false）
// その結果 Screen.web.tsx の display:none ロジックが効かず、全タブが同時表示されてしまう。
// 明示的に有効化することで、inactive な tab screen が display:none で隠れるようになる。
enableScreens(true);


export default function RootLayout() {
  const loadInbox = useTaskStore((s) => s.loadInbox);
  const loadToday = useTaskStore((s) => s.loadToday);
  const loadDoneToday = useTaskStore((s) => s.loadDoneToday);

  const { driftedTask, dismissDrift } = useFocusDriftDetection();

  useEffect(() => {
    // DB を開いてマイグレーション → 受信トレイ・今日タスク・本日完了を復元
    // 完了履歴は AI 見積もりの過去データとして使うため起動時に読む
    void getDb().then(() => Promise.all([loadInbox(), loadToday(), loadDoneToday()]));
  }, [loadInbox, loadToday, loadDoneToday]);

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
