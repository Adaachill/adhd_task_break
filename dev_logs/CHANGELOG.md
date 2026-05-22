# 開発履歴

## 2026-05-22: 画面2「今日の3タスク」実装
**ブランチ:** claude/today-screen-Tz4w

### 変更内容
- `src/types/task.ts`: `ShojikubaiTier`, `completedTier`, `timerStartedAt`, `completedAt` フィールド追加
- `src/db/index.ts`: 新カラムのマイグレーション（ALTER TABLE + 既存DB安全対応）
- `src/db/taskRepo.ts`: `listToday()` 追加、新フィールド対応
- `src/store/taskStore.ts`: `todayTasks`, `loadToday`, `moveToToday`, `moveToInbox`, `completeShojikubai`, `startBrakeTimer`, `stopBrakeTimer` 追加
- `src/hooks/useCountdown.ts`: 絶対時刻ベースのカウントダウンフック
- `src/services/notifications/index.ts`: expo-notifications ラッパー（許可取得・スケジュール・キャンセル）
- `src/features/today/ShojikubaiButtons.tsx`: 梅/竹/松ボタン
- `src/features/today/BrakeTimer.tsx`: 🔥タイマーUI（時間選択→カウントダウン→停止）
- `src/features/today/DoneOverlay.tsx`: 「できた！」演出モーダル（梅は3秒自動クローズ）
- `src/features/today/BrakeAlertModal.tsx`: タイムアップ警告（15分延長 / 強制終了）
- `src/features/today/TodayTaskCard.tsx`: カード統合コンポーネント
- `src/features/today/TaskPickerModal.tsx`: inboxからタスクを選ぶボトムシート
- `src/app/(tabs)/today.tsx`: 画面2メイン（単発/習慣タブ・3枠・空枠ピッカー）
- `src/app/_layout.tsx`: 起動時に `loadToday()` も実行

### 変更意図・背景
spec 画面2「今日の3タスク」を実装。「3枠上限で選択麻痺を防ぐ」「梅で即できた！演出」「🔥は時間制限必須」
という3つのUX方針をそのまま画面に落とし込んだ。

### 技術的決定事項
- タイマーは `timerStartedAt`（開始エポックms）を DB 保存する絶対時刻ベース。バックグラウンド復帰後も残り時間が正確
- `expo-notifications` でタイマー終了時のローカル通知をスケジュール。web は通知スキップで安全に動作
- ブレーキ警告は `BrakeAlertModal`（inApp）と通知（バックグラウンド）の2系統
- 梅達成時の `DoneOverlay` は3秒自動クローズで「すぐ次に進める」体験を演出
- `notifMap`（Map）で通知IDをメモリ管理し、停止時にキャンセル

### 残課題・次のステップ
- 作業中常時バナー（Android: ForegroundService / iOS: Live Activity）
- 画面3（褒めログ）
- 吐き出し画面に「今日やる↑」昇格ボタンを追加（現状はピッカー経由のみ）

## 2026-05-22: レスポンシブフォント + バッジ選択UI（PC/スマホ対応）
**ブランチ:** claude/affectionate-bell-PYjxQ

### 変更内容
- `src/hooks/useLayout.ts`: `useWindowDimensions` ベースの `isDesktop` / `fs`（フォントスケール）フック
- `src/components/ui/BadgeSelector.tsx`: 選択肢付きバッジコンポーネント
  - PC（幅≥768px）: クリックでドロップダウン表示 → 選択
  - モバイルweb（幅<768px）: マウスホバー（`onMouseEnter/Leave`）でドロップダウン表示
  - native: タップでサイクル（従来動作）
- `src/features/inbox/TaskBubble.tsx`: `BadgeSelector` を使用、フォントをレスポンシブ化
- `src/features/inbox/ChatList.tsx` / `InputBar.tsx`: フォントをレスポンシブ化
- `src/app/(tabs)/index.tsx`: PC で最大幅 720px にセンタリング、フォントをレスポンシブ化
- `src/app/(tabs)/_layout.tsx`: タブアイコン・ラベルをレスポンシブ化

### 変更意図・背景
PCブラウザで開いたとき文字が小さすぎる問題と、バッジ操作がスマホ向け「1タップサイクル」のみで
PCでは選択肢が分からない問題を解決。

### 技術的決定事項
- フォントスケール: <600px=等倍, 600-768px=1.1倍, ≥768px=1.25倍（`useWindowDimensions`）
- バッジUI判定は `isDesktop`（幅≥768px）で分岐。`Platform.OS === 'web'` との組み合わせで
  モバイルweb / デスクトップweb / native の3種類を区別
- RN 0.85.3 では `onMouseEnter`/`onMouseLeave` が型定義済みのため `@ts-expect-error` 不要
- ドロップダウンは absolute + zIndex で実装（Modal 不使用）。FlatList 内での z-index は
  `zIndex: 10`（BadgeSelector wrapper）+ `zIndex: 1`（badges コンテナ）で対応
- PC ではチャットを最大幅 720px にセンタリングして可読性を向上

### 残課題・次のステップ
- ドロップダウンが FlatList スクロール外にはみ出した場合の対処（現状は FlatList 内に収まる前提）
- native でのより直感的な選択UI（ボトムシート等）は将来検討

## 2026-05-22: TaskBrake 基盤構築 + 画面1（脳内吐き出し）
**ブランチ:** claude/affectionate-bell-PYjxQ

### 変更内容
- Expo（SDK56 / TypeScript / expo-router）プロジェクトを新規scaffoldし、デモ要素を撤去
- `src/theme/tokens.ts`: スライド由来のダークテーマ・トークン（色/余白/角丸/グラデ）
- `src/types/task.ts`: Task ドメインモデル（🔵/🔥 排他・期限・単発/習慣・分類出どころ）
- `src/db/{index,taskRepo}.ts`: expo-sqlite 接続＋マイグレーション＋CRUD（オフラインファースト）
- `src/store/taskStore.ts`: Zustand（受信トレイ復元・addTask・分類の1タップ補正）
- `src/services/classify/{types,heuristic,index}.ts`: 分類IF＋ローカル・ヒューリスティック（フォールバック）。`heuristic.test.ts` 単体テスト
- `src/components/ui/{GradientBackground,Bubble,Badge,IconButton,Placeholder}.tsx`: UIプリミティブ
- `src/features/inbox/{ChatList,TaskBubble,InputBar}.tsx`: 画面1のチャットUI
- `src/app/_layout.tsx` ＋ `(tabs)/{_layout,index,today,log}.tsx`: ルート＋3タブ（吐き出し/今日/褒めログ）
- `metro.config.js`: web で expo-sqlite の wasm を解決（assetExts＋COOP/COEP）

### 変更意図・背景
`docs/spec.md` とスライド（TaskBrake）に基づくMVPの第一歩。「起動直後に摩擦ゼロで吐き出せる」体験の核を、
基盤（足場・DB・状態・デザイン）と画面1（LINE風チャット＋🔵/🔥・期限の自動/手動仕分け）から段階的に立ち上げた。

### 技術的決定事項
- ナビは expo-router（ファイルベース）。AI分類はIF越しでローカル・ヒューリスティックを既定にし、実API（FastAPI+Claude）は後続で差し替え可能に
- 🔵/🔥 は排他。属性/期限はバッジ1タップでサイクル補正。永続化は store→DB の一方向
- 単体テストは jest-expo を避け、`tsx`＋`node:test`（純TSのヒューリスティックのみ対象）で軽量に

### 残課題・次のステップ
- 画面2（今日の3タスク：松竹梅・ブレーキタイマー）、画面3（褒めログ）、オーバーレイ（強制ブレーキ/離脱抑止）
- 通知（expo-notifications・絶対時刻ベース）、常時バナー、実AI分類API
- 実機/ブラウザでのUI目視確認（本環境では headless のため未実施）
