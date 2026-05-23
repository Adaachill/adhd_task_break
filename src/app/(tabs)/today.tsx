import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveSessionBanner } from '@/features/today/ActiveSessionBanner';
import { TaskPickerModal } from '@/features/today/TaskPickerModal';
import { TodayTaskCard } from '@/features/today/TodayTaskCard';
import { useLayout } from '@/hooks/useLayout';
import { requestPermissions } from '@/services/notifications';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';

const MAX_TODAY = 3;

type TabType = 'once' | 'habit';

export default function TodayScreen() {
  const { todayTasks, loadToday } = useTaskStore();
  const { fs, isDesktop } = useLayout();

  const [tab, setTab] = useState<TabType>('once');
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    void loadToday();
    void requestPermissions();
  }, [loadToday]);

  const filteredTasks = todayTasks.filter((t) =>
    tab === 'habit' ? t.isHabit : !t.isHabit
  );
  const canAdd = filteredTasks.length < MAX_TODAY;

  const renderEmptySlots = useCallback(() => {
    const slots = MAX_TODAY - filteredTasks.length;
    return Array.from({ length: slots }, (_, i) => (
      <Pressable
        key={`empty-${i}`}
        style={({ pressed }) => [styles.emptySlot, { opacity: pressed ? 0.7 : 1 }]}
        onPress={() => setPickerVisible(true)}
        disabled={!canAdd && i > 0}>
        <Text style={[styles.emptyIcon, { fontSize: fs.title }]}>＋</Text>
        <Text style={[styles.emptyTxt, { fontSize: fs.small }]}>吐き出しから選ぶ</Text>
      </Pressable>
    ));
  }, [filteredTasks.length, canAdd, fs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: fs.title }]}>今日の3タスク</Text>
        </View>

        {/* 🔥 作業中バナー（タイマー実行中のみ表示） */}
        <ActiveSessionBanner />

        {/* 単発 / 習慣タブ */}
        <View style={styles.tabRow}>
          {(['once', 'habit'] as TabType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabActive]}>
              <Text
                style={[
                  styles.tabTxt,
                  { fontSize: fs.small },
                  tab === t ? styles.tabTxtActive : styles.tabTxtInactive,
                ]}>
                {t === 'once' ? '単発' : '🔁 習慣'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* タスクカード + 空枠 */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {filteredTasks.map((task) => (
            <TodayTaskCard key={task.id} task={task} />
          ))}
          {renderEmptySlots()}
        </ScrollView>

        {/* 残り枠数表示 */}
        <View style={styles.footer}>
          <Text style={[styles.footerTxt, { fontSize: fs.caption }]}>
            {filteredTasks.length} / {MAX_TODAY} 枠使用中
          </Text>
        </View>
      </View>

      <TaskPickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  containerDesktop: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.text,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.surfaceAlt,
  },
  tabTxt: { fontWeight: '600' },
  tabTxtActive: { color: colors.text },
  tabTxtInactive: { color: colors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptySlot: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyIcon: {
    color: colors.textSecondary,
  },
  emptyTxt: {
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerTxt: {
    color: colors.textSecondary,
  },
});
