import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// フォアグラウンドでも通知バナーを表示する設定（native のみ）
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** ブレーキタイマー終了時のローカル通知をスケジュール。通知IDを返す。 */
export async function scheduleBrakeNotification(
  taskText: string,
  endTime: number
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏱ ブレーキ！時間です',
        body: `「${taskText}」の制限時間になりました。いったん止まりましょう。`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endTime),
      },
    });
    return id;
  } catch {
    return null;
  }
}

/** スケジュール済み通知をキャンセル */
export async function cancelNotification(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}
