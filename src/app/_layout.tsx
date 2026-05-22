import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { getDb } from '@/db';
import { useTaskStore } from '@/store/taskStore';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const loadInbox = useTaskStore((s) => s.loadInbox);

  useEffect(() => {
    // DB を開いてマイグレーション → 受信トレイ復元
    void getDb().then(() => loadInbox());
  }, [loadInbox]);

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
