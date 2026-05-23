# 開発履歴

## 2026-05-23: 今日タブ UI 改善 — タスク候補表示・並び替え・タイトル視認性向上
**ブランチ:** claude/task-list-ui-sorting-Ol57z

### 変更内容
- `src/app/(tabs)/today.tsx`:
  - SafeAreaView に `backgroundColor: colors.bgTop` を追加し、タイトル「今日の3タスク」の視認性を改善
  - 空枠の「吐き出しから選ぶ」ボタンを廃止し、インライン候補リスト（`TaskSuggestRow`）に差し替え
  - inbox タスクの読み込み（`loadInbox`）を追加
  - `taskOrder` 状態で今日タスクの表示順を管理（↑↓ボタンによる並び替えに対応）
  - `TodayTaskCard` に並び替えコールバックを渡すよう変更
- `src/features/today/TaskSuggestRow.tsx` (新規):
  - inbox タスクを「今日期限を最優先、次に作成日昇順」でソートしたカード列をを横スクロールで表示
  - タップで即座に今日枠に追加
  - 「すべて見る」で既存のフルピッカーモーダルを開く
  - タスクが0件の場合は空状態メッセージを表示
- `src/features/today/TodayTaskCard.tsx`:
  - `canMoveUp` / `canMoveDown` / `onMoveUp` / `onMoveDown` props を追加
  - カードヘッダーに ↑↓ 並び替えボタンを追加（端のカードは無効状態で表示）
- `src/features/today/TaskPickerModal.tsx`:
  - タスク一覧を今日期限優先・作成日昇順でソートして表示するよう変更

### 変更意図・背景
- タイトルが白に近い色でライトな背景に埋もれていたため、背景色を統一してコントラストを確保
- 「吐き出しから選ぶ」ボタンは手動でモーダルを開く必要があり、ADHD ユーザーにとって摩擦が大きかった。優先度付きの候補を自動表示することで意思決定を減らす
- 今日タスクの表示順を入れ替えられるようにし、ユーザーの意図に沿った順番で作業できるようにした

### 技術的決定事項
- 並び替えはローカル state（`taskOrder: string[]`）で管理。DB に order カラムを追加しないシンプルな実装を選択（アプリ再起動で初期化されるが、今日の作業セッション内での並び替えとして許容）
- ドラッグ & ドロップは外部ライブラリが必要なため ↑↓ ボタン方式を採用
- 候補リストは FlatList（horizontal）で実装し、右スワイプで追加候補を閲覧できる UX を実現

### 残課題・次のステップ
- 並び替え順の永続化（DB に order フィールド追加）
- ドラッグ & ドロップによる並び替え（react-native-reanimated 等）
- 候補リストへのフィルタリング（タイプ別・期限別）

## 2026-05-23: DeepSeek AI 統合 + 🔵 タスクの見積もり機能 — PR-B
**ブランチ:** claude/deepseek-estimate-9k4p

### 変更内容
- `api/ai.ts`: 新規 Vercel Edge Function。DeepSeek `/chat/completions` への proxy。`DEEPSEEK_API_KEY` をサーバ側で保持。レート制限（IP 1分20回）・タイムアウト 8s・`response_format: json_object`。
- `src/services/ai/deepseek.ts`: クライアント側ラッパ。`estimateTask(text, history, aiEnabled)` を提供。`EXPO_PUBLIC_AI_BASE_URL` で dev 環境のエンドポイント上書き可。失敗・タイムアウト時は `null` を返す（フェイルソフト）。
- `src/services/ai/types.ts`: `TaskEstimate` / `AiHistoryEntry` 型。
- `src/types/task.ts`: `estimatedMinutes` / `estimatedDifficulty` / `estimatedResistance` / `estimateRationale` / `estimateSource` を追加。
- `src/db/index.ts`: 上記5カラムを `ALTER TABLE` で追加。
- `src/db/taskRepo.ts`: insert/update/行マッパを新フィールド対応。
- `src/store/taskStore.ts`:
  - `moveToToday` で 🔵 かつ AI 有効時に `requestBlueEstimate` を fire-and-forget 起動。
  - 過去完了10件を `AiHistoryEntry[]` に整形して履歴として渡す（楽観バイアス補正用）。
  - `useEstimatingIds` ストアでローディング中タスク id を管理。
  - `moveToInbox` でも見積もり値は保持（再昇格時に流用）。
- `src/features/today/EstimateChip.tsx`: 新規。「⚡ AI見積もり：約 ◯分／難易度 ▓▓▓░░／抵抗感 ▓▓▓▓░」+ rationale を表示。推定中は dashed border の loading 表示。AI 失敗時は無表示に降格。
- `src/features/today/TodayTaskCard.tsx`: 🔵 表示時に `<EstimateChip>` を 🚀 始める の上に配置。
- `src/app/_layout.tsx`: 起動時に `loadDoneToday` も実行（AI に渡す履歴データを事前に揃える）。

### 変更意図・背景
ADHD の「見積もり甘い」課題に対する AI 補助。過去履歴を使って楽観バイアスを補正させる。DeepSeek を選んだのはコスト（input $0.27/M, output $1.10/M。1見積もり ≈ 0.03円）と OpenAI 互換 API（実装容易）の組み合わせ。

### 技術的決定事項
- **Vercel Edge Function proxy** を選択。API キーをクライアントに露出させない設計。`EXPO_PUBLIC_*` でビルドに埋め込む案は却下。
- **fire-and-forget**：moveToToday の応答性を落とさないため await しない。結果到着時に楽観的更新。
- **フェイルソフト**：AI 失敗時は EstimateChip が無表示になるだけで、🚀 / 松竹梅は通常通り動く。
- **見積もりは保持**：moveToInbox しても見積もりは消さない（再昇格時に API コール節約）。
- **履歴 10 件**：トークン消費を抑えつつユーザ固有の傾向を学習させる妥協点。
- **response_format: json_object** を DeepSeek に指定し、JSON パースの失敗率を最小化。型ガードで shape を検証、不正なら null。
- **レート制限はベストエフォート**：Edge ランタイムはリージョン分散で in-memory Map は完全ではないが、暴発防止には十分。

### Vercel デプロイ手順
1. Vercel ダッシュボードで `DEEPSEEK_API_KEY` を Environment Variables に追加（Production / Preview / Development 全環境）。
2. 任意で `DEEPSEEK_API_URL` / `DEEPSEEK_MODEL` を上書き設定可能。
3. デプロイ後、`/api/ai` が叩けるようになる。

### 残課題・次のステップ
- **PR-C**: 完了時 AI フィードバックモーダル（generateFeedback）。
- ユーザによる見積もり値の手動修正 UI（estimateSource='manual'）。
- ログタブで「今日の見積もり精度 ◯%」集計表示。
- レート制限を KV / Upstash Redis に移行（多リージョン共有）。

---

## 2026-05-23: 🔵 タスクの計測ループ（取り掛かりラグ + 実測分数）— PR-A
**ブランチ:** claude/blue-measure-7m2f

### 変更内容
- `src/types/task.ts`: `movedToTodayAt` / `blueStartedAt` / `timeToStartSeconds` / `continued` を追加。
- `src/db/index.ts`: 上記4カラムを `ALTER TABLE` で追加（既存パターン踏襲）。
- `src/db/taskRepo.ts`: 行マッパ・insert・update を新フィールド対応。
- `src/store/taskStore.ts`:
  - `moveToToday` で `movedToTodayAt = now` を記録（取り掛かりラグの起点）。
  - 新 `startBlueTask(id)` で `blueStartedAt` 記録 + `timeToStartSeconds` 計算。
  - `completeShojikubai` で 🚀 押下済みなら `workedMinutes = (now - blueStartedAt)/60s`、`continued = true` を保存。押してなければ null のまま。
  - `moveToInbox` で計測値をリセット。
- `src/features/today/StartTaskButton.tsx`: 新規。🔵 用「🚀 始める」ボタン。押下後は経過時間 mm:ss を pill で表示。
- `src/features/today/TodayTaskCard.tsx`: 🔵 表示時に `<StartTaskButton>` を 松竹梅ボタンの上に配置。
- `src/app/(tabs)/log.tsx`: 🔵 で 🚀 押下済みのものは「⏱ ◯分」バッジと「🚀 取り掛かりまで ◯◯」サブテキストを表示。

### 変更意図・背景
ADHD の3課題（① 見積もり甘い、② 取り掛かりに時間、③ 気が散る）に対し、まずは「測ること」だけで効用を出す PR-A。AI 抜きで実測ループを動かす。受信トレイから today に移動した瞬間を「取り掛かりを意識した瞬間」と定義し、🚀 ボタンを押すまでの遅延（time-to-start）と、🚀 から松竹梅完了までの所要時間（workedMinutes）を記録する。

### 技術的決定事項
- **🚀 押下は任意**：ADHD は「いきなり始めて気づいたら終わってた」ケースも多いため、押さずに直接松竹梅タップも許容。その場合は workedMinutes/timeToStartSeconds は null。
- **🔵 と 🔥 で計測カラムを分離**：🔥 は既存 `timer_started_at` がカウントダウン用に固定されているため、🔵 用に別途 `blue_started_at` を新設。意味論を混ぜない。
- **取り掛かりラグの起点 = moveToToday**：「今日やる」と決めた瞬間からの遅延が ADHD 当事者にとって最も意味のある計測対象。inbox 作成時刻ではない。
- **`continued`** カラム：PR-A では「完了に到達 = 継続成功」とみなし `true` のみ記録。中断ボタンによる `false` 記録は後続 PR で。

### 残課題・次のステップ
- **PR-B**: Vercel `/api/ai` サーバレス関数 + DeepSeek 統合。`moveToToday` 時に AI 見積もり（時間・難易度・抵抗感）を自動取得し、TodayTaskCard に EstimateChip 表示。
- **PR-C**: 完了時の AI フィードバックモーダル。見積もり vs 実測のギャップを優しく解説。
- 中断ボタン UI（`continued = false` 記録）。
- ログタブの集計に「見積もり精度」「平均取り掛かりラグ」追加。

---

## 2026-05-23: 作業中離脱抑止（バナー + 復帰ポップアップ）
**ブランチ:** claude/focus-drift-3a7k

### 変更内容
- `src/hooks/useFocusDriftDetection.ts`: 新規。AppState（native）/ `visibilitychange`（web）でバックグラウンド遷移を検知。🔥 ブレーキタイマー実行中のみ動作し、復帰までの時間が閾値（5秒）以上なら離脱とみなす。
- `src/features/today/FocusDriftPopup.tsx`: 復帰時のモーダル「戻ってきましたね／そのまま続ける／中断する」。
- `src/features/today/ActiveSessionBanner.tsx`: 画面2上部に固定表示する作業中バナー「🔥 作業中：〇〇 — 残り MM:SS」。
- `src/services/notifications/index.ts`: `scheduleDriftNotification(taskText, delayMs)` を追加。バックグラウンド遷移時に遅延発火させ、復帰時に必ずキャンセル。
- `src/app/_layout.tsx`: `useFocusDriftDetection` をルートにマウントし、`<FocusDriftPopup>` をグローバルモーダルとして配置。
- `src/app/(tabs)/today.tsx`: `<ActiveSessionBanner />` をヘッダー直下に配置。

### 変更意図・背景
spec ⑥「作業中離脱抑止」の MVP 実装。ADHD の過集中・タスクすり替えを防ぐため、🔥 タイマー走行中に他アプリへ切り替わった場合に通知＋復帰時ポップアップで作業へ引き戻す。spec 1.2-5 にあるとおり、OS 制約で「他アプリ起動の直接検知」は不可なので、自アプリのバックグラウンド遷移をトリガにしている。

### 技術的決定事項
- **閾値 5 秒**：通知センターを一瞬開いただけで発火しないよう、5 秒未満の離脱はポップアップを出さない。短時間の確認は離脱とみなさない設計。
- **通知遅延 10 秒**：バックグラウンド直後に通知を出すと「ただ通知センター開いただけ」のケースで邪魔になる。10 秒経っても戻ってこなければ離脱と判断して通知発火。復帰時には必ずキャンセル。
- **検知範囲は 🔥 のみ**：MVP では「作業セッション」を明確に持つのは 🔥 のブレーキタイマーだけ。🔵 の松竹梅はワンタップ完了なので作業セッションの概念がない。
- **Web 対応**：`Page Visibility API`（`document.visibilitychange`）で同等の挙動を実現。native 通知は出ないが、復帰時のポップアップは出る。SSR ガード（`typeof document === 'undefined'`）あり。
- **マウント位置**：ルートレイアウト（`_layout.tsx`）にフック＋ポップアップを配置することで、他タブにいるときも離脱検知が動く。

### 残課題・次のステップ
- 🔵 タスクにも「作業セッション」の概念を導入するか検討（現状は松竹梅タップで即完了）。
- iOS Live Activity / Android フォアグラウンドサービスでの「OS レベル常時バナー」（spec 3.2 のフル実装）は v2。
- バナーのアニメーション（パルス等）でより視認性を上げる。

---

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
