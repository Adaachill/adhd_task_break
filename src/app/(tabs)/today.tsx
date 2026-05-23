import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveSessionBanner } from '@/features/today/ActiveSessionBanner';
import { TaskPickerModal } from '@/features/today/TaskPickerModal';
import { TaskSuggestRow } from '@/features/today/TaskSuggestRow';
import { TodayTaskCard } from '@/features/today/TodayTaskCard';
import { useLayout } from '@/hooks/useLayout';
import { requestPermissions } from '@/services/notifications';
import { useTaskStore } from '@/store/taskStore';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Task } from '@/types/task';

const MAX_TODAY = 3;

type TabType = 'once' | 'habit';

export default function TodayScreen() {
  const { todayTasks, tasks: inboxTasks, loadToday, loadInbox } = useTaskStore();
  const { fs, isDesktop } = useLayout();

  const [tab, setTab] = useState<TabType>('once');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [taskOrder, setTaskOrder] = useState<string[]>([]);

  useEffect(() => {
    void loadToday();
    void loadInbox();
    void requestPermissions();
  }, [loadToday, loadInbox]);

  const filteredTasks = todayTasks.filter((t) =>
    tab === 'habit' ? t.isHabit : !t.isHabit
  );

  // Sync taskOrder when filteredTasks changes
  useEffect(() => {
    setTaskOrder((prev) => {
      const currentIds = new Set(filteredTasks.map((t) => t.id));
      const kept = prev.filter((id) => currentIds.has(id));
      const added = filteredTasks.filter((t) => !prev.includes(t.id)).map((t) => t.id);
      return [...kept, ...added];
    });
  }, [filteredTasks]);

  const orderedTasks = taskOrder
    .map((id) => filteredTasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const canAdd = filteredTasks.length < MAX_TODAY;

  const moveTaskUp = (index: number) => {
    if (index <= 0) return;
    setTaskOrder((prev) => {
      const taskIds = orderedTasks.map((t) => t.id);
      const next = [...prev];
      const idxA = prev.indexOf(taskIds[index - 1]);
      const idxB = prev.indexOf(taskIds[index]);
      if (idxA >= 0 && idxB >= 0) [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  };

  const moveTaskDown = (index: number) => {
    if (index >= orderedTasks.length - 1) return;
    setTaskOrder((prev) => {
      const taskIds = orderedTasks.map((t) => t.id);
      const next = [...prev];
      const idxA = prev.indexOf(taskIds[index]);
      const idxB = prev.indexOf(taskIds[index + 1]);
      if (idxA >= 0 && idxB >= 0) [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
      return next;
    });
  };

  const inboxForTab = inboxTasks.filter((t) =>
    tab === 'habit' ? t.isHabit : !t.isHabit
  );

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

        {/* タスクカード + 候補リスト */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {orderedTasks.map((task, index) => (
            <TodayTaskCard
              key={task.id}
              task={task}
              canMoveUp={index > 0}
              canMoveDown={index < orderedTasks.length - 1}
              onMoveUp={() => moveTaskUp(index)}
              onMoveDown={() => moveTaskDown(index)}
            />
          ))}

          {canAdd && (
            <TaskSuggestRow
              tasks={inboxForTab}
              emptySlots={MAX_TODAY - filteredTasks.length}
              onSelectMore={() => setPickerVisible(true)}
            />
          )}
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
  safe: { flex: 1, backgroundColor: colors.bgTop },
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
    fontWeight: '800',
    letterSpacing: 0.3,
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
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerTxt: {
    color: colors.textSecondary,
  },
});
