import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { cancelNotification, scheduleDriftNotification } from '@/services/notifications';
import { useTaskStore } from '@/store/taskStore';
import type { Task } from '@/types/task';

// 離脱とみなす最小バックグラウンド時間（msec）
// 短すぎると一瞬の通知センター操作でも発火してしまうため 5 秒に設定
const DRIFT_THRESHOLD_MS = 5_000;

// 復帰時に通知を出すまでの遅延（msec）。短い離脱では通知不要なので遅延発火させる。
const NOTIFY_DELAY_MS = 10_000;

function findActiveSession(tasks: Task[]): Task | null {
  return (
    tasks.find(
      (t) =>
        t.type === 'fire' && t.timerStartedAt !== null && t.status === 'today'
    ) ?? null
  );
}

interface DriftState {
  driftedTask: Task | null;
  dismissDrift: () => void;
}

/**
 * 作業中離脱抑止（spec ⑥）。
 * - 🔥 のブレーキタイマーが走っているときに限り、AppState (native) /
 *   visibilitychange (web) で「バックグラウンド遷移→復帰」を検知。
 * - バックグラウンド遷移時に native ローカル通知を遅延スケジュール、復帰時にキャンセル。
 * - 一定時間以上離脱していたら復帰時ポップアップで引き戻す。
 *
 * 注：他アプリ起動の直接検知は OS 制約で不可（spec 1.2-5）。本フックは自アプリの
 * 表示・非表示遷移をトリガにしている。
 */
export function useFocusDriftDetection(): DriftState {
  const [driftedTask, setDriftedTask] = useState<Task | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const pendingNotifId = useRef<string | null>(null);

  useEffect(() => {
    const handleBackground = async () => {
      const active = findActiveSession(useTaskStore.getState().todayTasks);
      if (!active) return;
      backgroundedAt.current = Date.now();
      const id = await scheduleDriftNotification(active.text, NOTIFY_DELAY_MS);
      pendingNotifId.current = id;
    };

    const handleForeground = async () => {
      const notifId = pendingNotifId.current;
      pendingNotifId.current = null;
      if (notifId) {
        await cancelNotification(notifId);
      }
      const bgAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (bgAt === null) return;
      const duration = Date.now() - bgAt;
      if (duration < DRIFT_THRESHOLD_MS) return;
      const active = findActiveSession(useTaskStore.getState().todayTasks);
      if (active) setDriftedTask(active);
    };

    if (Platform.OS === 'web') {
      // SSR ガード（Expo Router の静的レンダリング時に document が無い）
      if (typeof document === 'undefined') return;
      const onVis = () => {
        if (document.visibilityState === 'hidden') {
          void handleBackground();
        } else {
          void handleForeground();
        }
      };
      document.addEventListener('visibilitychange', onVis);
      return () => document.removeEventListener('visibilitychange', onVis);
    }

    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') {
        void handleBackground();
      } else if (s === 'active') {
        void handleForeground();
      }
    });
    return () => sub.remove();
  }, []);

  return {
    driftedTask,
    dismissDrift: () => setDriftedTask(null),
  };
}
