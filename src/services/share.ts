import { Platform, Share } from 'react-native';

// 褒めログの結果をシェアする。native は Share シート、web は clipboard フォールバック。
export async function shareText(message: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Web Share API があれば使う。なければクリップボードへ。
    const nav = globalThis.navigator as Navigator | undefined;
    try {
      if (nav?.share) {
        await nav.share({ text: message });
        return;
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(message);
        return;
      }
    } catch {
      // ユーザーキャンセル等は無視
    }
    return;
  }

  try {
    await Share.share({ message });
  } catch {
    // ユーザーキャンセル等は無視
  }
}
