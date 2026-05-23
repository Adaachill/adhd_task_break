# 開発履歴

## 2026-05-22: Vercel への Web デプロイ対応（iPhone オンライン利用）
**ブランチ:** claude/web-deploy-vrcl

### 変更内容
- `vercel.json`: `npx expo export -p web` で `dist/` を生成、`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` を全パスに付与。
- `public/manifest.webmanifest`: PWA マニフェスト（standalone・theme_color・icons）を追加。
- `public/icon-512.png` / `public/apple-touch-icon.png` / `public/favicon.png`: PWA・iOS ホーム画面アイコンを配置。
- `src/app/+html.tsx`: Expo Router の HTML ルートを上書きし、`viewport-fit=cover`、`apple-mobile-web-app-capable`、`apple-mobile-web-app-status-bar-style=black-translucent`、`manifest.webmanifest` への link 等を挿入。
- `src/services/notifications/index.ts`: `Notifications.setNotificationHandler` の呼び出しを `Platform.OS !== 'web'` でガード。web で import 時に native API が走るのを回避（既存ブロッカー）。
- `README.md`: Vercel 接続手順・PWA 対応・Web の制約を追記。

### 変更意図・背景
MVP3画面が揃ったので、iPhone Safari でオンライン利用しながら開発できるようにしたかった。push 連動の自動デプロイと、`vercel.json` で COOP/COEP をネイティブに付けられる利点から Vercel を選定。expo-sqlite（wa-sqlite）はブラウザで `SharedArrayBuffer` を要求するため、COOP/COEP の付与が必須。

### 技術的決定事項
- **ホスティング選定**: GitHub Pages は静的ヘッダー付与不可、Cloudflare Pages / Netlify と比較し、Vercel は Expo コミュニティ採用例が多く `framework: null` での Expo 静的出力との相性が良い点を重視。
- **`installCommand` を `npm ci --legacy-peer-deps` に上書き**: expo-notifications 追加時に peer dep 解決のため `--legacy-peer-deps` でロックファイルを生成しているため。
- **+html.tsx の採用**: Expo Router 静的レンダリングでは `+html.tsx` が HTML ルートのカスタマイズに使う標準的手段。`app.json` の web meta では Apple 専用タグを十分にカバーできない。
- **アイコンは単一サイズ（512）で manifest 登録**: ブラウザが自動ダウンスケールするので、MVP 段階では複数サイズ生成のコストを払わない。

### 残課題・次のステップ
- iOS 16.4+ の PWA Web Push 対応（タブ閉鎖時のブレーキ通知）— v2 で検討。
- アイコン 192/256/384 サイズの個別生成（Lighthouse PWA スコア向上）。
- ServiceWorker 導入による静的アセットのオフラインキャッシュ。

---

## 2026-05-22: 画面3「本日の褒めログ」実装
**ブランチ:** claude/praise-log-Qw9k

### 変更内容
- `src/types/task.ts`: `workedMinutes`（実測分数）フィールド追加
- `src/db/index.ts`: `worked_minutes` カラムのマイグレーション
- `src/db/taskRepo.ts`: `listDoneBetween(start, end)` 追加、`worked_minutes` 対応
- `src/store/taskStore.ts`: `doneTasks`, `loadDoneToday`, `completeFireTask(id, workedMinutes)` 追加。完了時に `doneTasks` を更新
- `src/features/today/BrakeTimer.tsx`: 「止める」を「終わった！＝早期完了」に変更し、実測分数を親へ通知
- `src/features/today/TodayTaskCard.tsx`: 🔥タスクの完了配線（早期完了 / タイムアップ後の強制終了）＋完了演出
- `src/services/share.ts`: シェアヘルパー（native=Shareシート / web=Web Share API or clipboard）
- `src/app/(tabs)/log.tsx`: 画面3メイン（大見出し「今日○○分動けた！」・完了タスク一覧・梅竹松/🔥分バッジ・シェア）
- `src/components/ui/Placeholder.tsx`: 全タブ実装完了により削除

### 変更意図・背景
spec 画面3「本日の褒めログ」を実装。「できたことだけを最大化して褒める」「未完了は非表示で自己嫌悪を防ぐ」
「スクショ映え＋SNS拡散導線」という方針を反映。あわせて🔥タスクが done に到達する完了フローを整備し、
集中時間（workedMinutes）を実測・集計できるようにした。

### 技術的決定事項
- 「動けた分数」は 🔥タスクの実測分数（`workedMinutes`）の合計。🔵タスクは時間計測しないため、分数0なら
  見出しを「今日 N個 動けた！」に切り替える適応表示
- 🔥完了は2経路：①カウントダウン中「終わった！」＝開始からの経過分（最低1分）、②タイムアップ後「強制終了して休憩」＝設定分フル
- 当日判定は 0:00〜翌0:00 のローカル時刻範囲を `completed_at` で絞り込み（`listDoneBetween`）
- 褒めログはタブ `useFocusEffect` で都度再取得（他タブで完了したタスクを即反映）
- シェアは追加依存を増やさず RN 標準 `Share` ＋ web フォールバック（Web Share API / clipboard）

### 残課題・次のステップ
- 作業中常時バナー（Android: ForegroundService / iOS: Live Activity）
- 離脱抑止（AppState background 遷移トリガ）
- 過去日の褒めログ閲覧・連続達成日数などの継続支援
- スクショ映えするシェア用画像生成（現状はテキストシェア）

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
