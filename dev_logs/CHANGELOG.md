# 開発履歴

## 2026-06-07: 習慣化タスクの GitHub-grass 風ヒートマップ + 日次リセット
**ブランチ:** claude/pensive-archimedes-qyhUI

### 変更内容
- `src/db/sessionRepo.ts`: `sumTaskMinutesBetween` / `sumTaskMinutesToday` / `listSessionsForTasksBetween` を追加。
- `src/db/taskRepo.ts`: `listHabitTasks`（text 単位で最新1件）と `listTaskIdsByTexts`（同テキストの過去タスクid解決）を追加。
- `src/store/taskStore.ts`: 習慣タスクの `workedMinutes` 計算を「今日のセッション分」だけに切り替え（`sumWorked()` ヘルパー）。`reopenTask` で前日以前に完了した習慣の `workedMinutes` を null にリセット。
- `src/features/habits/HabitHeatmap.tsx`: 新規。過去12週間の草グリッドを描画する。
  - 上段: 集計ヒートマップ（こなした件数 × 15 + 合計分数 でスコア化）。青→紫のスケール。
  - 下段: 習慣タスク（text 単位）ごとの行。緑スケールで分数を可視化。
  - セルタップで日付・件数・分数の詳細を下部に表示。
- `src/app/(tabs)/today.tsx`: 「🔁 習慣」タブ表示時に `<HabitHeatmap />` をスクロール先頭に描画。

### 変更意図・背景
習慣化タスクは「続けていること」自体が成果なので、毎日の積み上げを一覧で見える化することで継続のインセンティブを上げたい。GitHub の contribution graph は「途切れさせたくない」心理を引き出す UI として定着しており、これを参考にした。また、累積 `workedMinutes` だと「今日まだやっていない」のか「昨日までの貯金で済ませた」のか区別できないため、習慣に限り日次リセットすることで「今日の取り組み」だけが画面に出るようにした。

### 技術的決定事項
- 集計の重み付け: 件数 × 15 + 分数。短時間でも複数習慣をこなした日が色付くようにしつつ、長時間集中した日も濃くなるよう件数を厚めに評価。
- 日跨ぎセッション: `started_at` の所属日に丸ごと帰属させる（split しない）。シンプルさを優先。
- 習慣の同定: `task.id` ではなく `task.text` で同一視。リスタートや再生成で id が変わっても草が途切れないよう text 単位で集計。
- 範囲: 12週間（84日）を1スクリーン目安に固定。将来的に縦横スクロールで1年表示にも拡張可能。
- 色スケール: 暗背景に合わせ GitHub の緑を濃いめ（`#39D353` ピーク）にチューニング。集計は青→紫のアクセント系で別物だと一目で分かるようにした。

### 残課題・次のステップ
- ヒートマップ範囲を「30日 / 12週 / 1年」で切り替えるトグル。
- 実行中（未 close）セッションも含めるかオプション化。
- 連続日数（ストリーク）の表示。
- タスクごとの行並び替え（最終実施日順 / 連続日数順）。

## 2026-06-03: 作業セッションテーブル導入で中断あり時間計測を正確に
**ブランチ:** claude/work-sessions-tracking

### 変更内容
- `src/db/index.ts`: `work_sessions` テーブル（id, task_id, kind, started_at, ended_at, created_at）と関連インデックスを追加するマイグレーションを追加。
- `src/db/sessionRepo.ts`: 新規。`openSession` / `closeOpenSession` / `sumTaskMinutes` / `listSessions` を提供。
- `src/store/taskStore.ts`: `startBlueTask` / `startBrakeTimer` でセッションを open、`pauseBlueTask` / `stopBrakeTimer` / `completeShojikubai` / `completeFireTask` でセッションを close し `sumTaskMinutes()` で `workedMinutes` を再計算するよう変更。
- `src/features/today/BrakeTimer.tsx`: `handleStop` / `handlePause` が中断・再開を含む全期間の累計分数を渡すよう修正（`totalWorkedMinutes()` 追加）。

### 変更意図・背景
従来の実装では🔥タスクの「終わった！」押下時に `elapsedMinutes(timerStartedAt)` のみを完了分数として渡しており、中断・再開を経た場合に直近セグメント分しか記録されず、実作業時間と乖離していた。中断パターンを正しく扱えるよう、各セッション（開始〜終了）を別レコードで保持する設計に切り替えた。

### 技術的決定事項
- DBスキーマ案2つ（A: 新テーブル `work_sessions` / B: `tasks.work_intervals` JSON カラム）を検討し、Aを採用。理由：将来「セッション別の編集／表示」「日次集計の高速化」「タイムラインビューの精度向上」など拡張が見込まれ、関係テーブル化した方がクエリしやすいため。
- `workedMinutes` カラムは互換のため残置し、セッション合算のキャッシュ的役割に降格。表示・統計はまずこの値を参照する既存コードを変えずに動くようにした。
- `openSession()` 内で多重 open を防ぐため既存 open セッションを強制 close する（安全策）。

### 残課題・次のステップ
- 既存タスクの `workedMinutes` から擬似セッション（completed_at − workedMinutes 〜 completed_at）を生成するバックフィルマイグレーション。
- 褒めログタイムラインビュー（`TimelineView.tsx`）の `taskToSegments()` を `work_sessions` 直読みに切り替え、複数セッションを正確に描画。
- セッション単位の編集UI（誤計測の手動修正）。

## 2026-06-02: 褒めログに24時間タイムラインビューを追加
**ブランチ:** claude/optimistic-dirac-8HlON

### 変更内容
- `src/features/praiseLog/TimelineView.tsx`: 24時間の縦軸タイムラインを描画する新規コンポーネント
- `src/app/(tabs)/log.tsx`: 「✨ 褒め」「🕒 タイムライン」の切替タブを追加し、タイムラインビューを表示
- `dev_logs/CHANGELOG.md`: 本エントリ追加

### 変更意図・背景
ユーザーから、1日のタスク完了数・作業時間・取り組んだ時間帯を24時間軸でマップ表示してほしいという要望があり、褒めログタブ内に追加した。

### 技術的決定事項
- 新しいタブを追加するのではなく、既存「褒めログ」タブ内にトグルを置くことで導線を維持。
- 各タスクの開始時刻は `timerStartedAt`（🔥）／`blueStartedAt`（🔵）を優先し、無ければ `completedAt - workedMinutes` をフォールバックに使用。
- 「開始時間が複数ある場合は均等に１日単位では分割」の要件を満たすため、`taskToSegments()` 内で `workedMinutes / starts.length` の幅でセグメントを生成する設計にした。将来DBスキーマで複数開始時刻を持つようになっても無改造で対応可能。
- ブロックの位置と高さは1時間=44pxスケールで計算し、最小可視高さ18pxを確保。色はティアカラー（梅/竹/松）または🔥/🔵で識別。
- 当日範囲（dayStart〜dayEnd）にクランプして、日跨ぎの作業でも崩れないようにした。

### 残課題・次のステップ
- 開始時間・継続時間のインライン編集UI（タイムライン上のブロックタップで編集モーダル）
- 日付ナビゲーション（昨日・過去日のタイムライン閲覧）
- ブロックの重なり時の横並び表示（現状は重なって表示される）
## 2026-06-02: ほめログの完了タスク編集で計測時間も編集可能に
**ブランチ:** claude/gracious-cerf-Mee4B

### 変更内容
- `src/app/(tabs)/log.tsx`: `EditModal` に「計測時間（分）」の入力欄を追加。数値のみ許可（非負整数）し、変更があれば `workedMinutes` を patch として保存。
- `src/store/taskStore.ts`: `updateDoneTask` の patch 型に `workedMinutes` を追加。

### 変更意図・背景
🔥タスクのアラーム止め忘れなどで `workedMinutes` が実際より大きく記録されることがあり、ほめログの合計分数が不自然に膨らんでしまう。完了済みタスクのテキストだけでなく計測時間も後から手で修正できるようにする。

### 技術的決定事項
- 入力は数値専用キーボードで受け、`replace(/[^0-9]/g, '')` で非数字を排除。空文字の場合は `workedMinutes` を変更しない（誤クリアの防止）。
- 既存の `updateDoneTask` をそのまま利用し、永続化・todayTasks との同期もそのまま流用。

### 残課題・次のステップ
- 必要であればタイマー目標（`timerMinutes`）や松竹梅の見積もり編集もここから可能にする案。
- 入力時のバリデーション上限（例: 24時間=1440分）を将来的に検討する。

## 2026-06-01: 松竹梅の並び順を全画面で梅→竹→松に統一
**ブランチ:** claude/fix-tier-order-v2-9R3sM

### 変更内容
- `src/features/today/TierSelectModal.tsx`: `TIER_OPTIONS` の並びを 松→竹→梅 から 梅→竹→松 に変更
- `src/features/today/ShojikubaiEditor.tsx`: `FIELDS` の並びを 松→竹→梅 から 梅→竹→松 に変更（前回 PR の方向を反転）
- `src/features/today/TodayTaskCard.tsx`: `TierEstimateRow` の入力欄を 松→竹→梅 から 梅→竹→松 に並び替え

### 精査結果（その他の松竹梅順序を扱う箇所）
- `src/features/today/ShojikubaiButtons.tsx`: 既に 梅→竹→松 順 ✅ 修正不要
- `src/app/(tabs)/log.tsx` の `TIER` カラー辞書: 順序を持たないオブジェクト ✅ 修正不要
- `src/services/praiseComment.ts`: 件数集計のみで順序を表示しない ✅ 修正不要
- `src/services/ai/types.ts` / `api/ai.ts`: 型定義のユニオン順だけで表示に影響しない ✅ 修正不要

### 変更意図・背景
完了時のスクショで、ユーザーが「松（理想）が一番下に来てほしい」「内容と見積もり時間が梅→竹→松の順に並んでいる方が自然」とフィードバック。
画面の上から下へ＝低い基準から高い基準へ積み上がる方が、ADHD ユーザーの「梅でもまず手を付ければOK」というメンタルモデルに合う。
`ShojikubaiButtons`（既に 梅→竹→松 順）と統一が取れた。

### 技術的決定事項
- DB のキー（`shojikubai.ume` / `take` / `matsu`）は変更なし。表示順序だけを反転。
- ロジックの並び順（型定義の `'ume' | 'take' | 'matsu'`）はすでに 梅→竹→松 順だったので、視覚側を合わせる方向で統一。

### 残課題・次のステップ
- 既存ユーザーが過去に入力した shojikubai のキーずれは自動修正できない（自由テキストのため）。
  該当ユーザーには再入力で対応してもらう。

## 2026-06-01: 松竹梅エディタの並び順を完了モーダルと揃える
**ブランチ:** claude/fix-tier-order-7K2pQ

### 変更内容
- `src/features/today/ShojikubaiEditor.tsx`: 入力欄の並び順を `梅→竹→松` から `松→竹→梅` に変更

### 変更意図・背景
入力欄が上から梅→竹→松だったが、完了時の `TierSelectModal` と褒めログの表示はすべて 松→竹→梅 順だったため、ユーザーが入力した内容と完了時に表示される松竹梅の内容が逆順に見えていた。一番上を「松（理想）」と認識して入力したユーザーが、実は梅フィールドに書き込んでしまう不整合を修正。

### 技術的決定事項
DB のキーはそのまま。表示順序だけを反転して「視覚的に上にあるほど高い基準」という一貫性を確保。`TierEstimateRow`（松→竹→梅）とも順序が揃う。

### 残課題・次のステップ
- 既存ユーザーが過去に誤って入力した shojikubai データの修正 UI が必要かは要検討（ただし内容は自由テキストなので、再入力で済む）

## 2026-06-01: 習慣タスクの常駐 / 完了タスク再開 / 沼タスクに作業目標フロー
**ブランチ:** claude/blissful-bell-3H2Gp

### 変更内容
- `src/types/task.ts`: `Task` に `timerGoal: string | null` を追加（🔥 沼タスクの中断時間までの作業目標）
- `src/db/index.ts`: `timer_goal TEXT` カラムをマイグレーションに追加
- `src/db/taskRepo.ts`:
  - `timer_goal` を行マッピング・INSERT・UPDATE に追加
  - `listToday(start, end)` を拡張：習慣化タスク（`is_habit=1`）が当日完了した場合も今日のタスクとして返す
- `src/store/taskStore.ts`:
  - `loadToday` を当日範囲付きで呼び出すよう変更（習慣完了タスクを today に残す）
  - `completeShojikubai` / `completeFireTask`：習慣タスクは完了しても `todayTasks` から消さない（done としても保持し、`doneTasks` にも入れる）
  - `stopBrakeTimer`：中断時に経過分数を `workedMinutes` に積算するよう修正（従来は単にタイマーを止めるだけだった）
  - `startBrakeTimer(id, minutes, goal, notificationId?)`：作業目標を受け取って保存
  - 新規 `reopenTask(id)`：完了タスクを today に戻す（完了情報をクリアして再度より上の松竹梅を選べるように）
  - 新規 `updateDoneTask(id, patch)`：ほめログからの編集用
  - `addTask` の初期値に `timerGoal: null` を追加
- `src/features/today/BrakeTimer.tsx`:
  - 時間選択 → 作業目標入力モーダル → タイマー開始 の二段階フローに
  - タイマー実行中に 🎯 目標チップを表示
  - 「終わった！」/「⏸ 中断」時に目標達成確認モーダルを出し、「達成できた！」を選ぶと褒める演出（`GoalAchievedOverlay`）を表示
- `src/features/today/TodayTaskCard.tsx`:
  - `task.status === 'done'` のとき（＝完了済み習慣タスク）「再開して追加作業」ボタンを表示し、`reopenTask` を呼ぶ
  - 完了済みカードはサクセスカラーで縁取り
  - 🎯 目標達成時の `GoalAchievedOverlay` を追加
- `src/app/(tabs)/today.tsx`:
  - 枠カウント（MAX_TODAY=3）は `status==='done'` のタスクを除外（完了済み習慣タスクは枠を消費しない）
- `src/app/(tabs)/log.tsx`:
  - 行タップで `reopenTask`（確認ダイアログ付き、Web は `window.confirm`、Native は `Alert.alert`）
  - 行右端の ✎ ボタンで `EditModal` を開き、タスク名を編集（`updateDoneTask` を呼ぶ）

### 変更意図・背景
- 習慣化タスクは毎日繰り返す性質なので、完了しても今日のタスクタブから消えてしまうと「今日もうやったっけ？」が分からなくなる。当日中は残して達成済みの状態で見せる。
- 完了したタスクでも、追加で作業して梅→竹→松へとレベルアップしたいというユーザーニーズに応える。ほめログのタスクをタップで再開できるようにすることで、達成感を上書きできるようにする。
- 編集を「今日のタスク」「ほめログ」「PC/スマホ」のいずれでもできるようにする。ほめログの編集は最低限「タスク名」だけだが、Modal で React Native Web / iOS / Android 共通で動く。
- 🔥 沼タスクは「時間を決めて中断」だけだと、何をどこまでやるかが曖昧で目標達成感が得にくい。タイマー開始前に「中断時間までにどこまで」をユーザーに宣言させ、中断/完了時に達成できたかを聞くことで、自己効力感を高める褒めアクションを設けた。中断時には経過時間を `workedMinutes` に積算するため、純粋な「ちょっと止めた」も作業時間として残る。

### 技術的決定事項
- 完了済み習慣タスクを today に残す方法：DB の status は `done` のままにし、`listToday` が「`is_habit=1` かつ当日完了」を OR でマージして返す。`status` をいじらないので褒めログ集計（`listDoneBetween`）も従来どおり動く。
- `stopBrakeTimer` を「中断時間積算」に拡張：従来は別途明示的に積算する経路がなく、🔥 タスクの中断は時間がカウントされていなかった。
- 作業目標は `Task` 自体のカラム（`timerGoal`）として保持。タイマー開始ごとに上書きされ、リスタート（タイマー延長）時は前の goal を引き継ぐ。
- ほめログ画面の編集は本格的な再利用カードではなく軽量モーダル。タップで再開する主動線とぶつからないよう、編集は専用の ✎ ボタンに分離した。

### 残課題・次のステップ
- 編集モーダルでタスク名以外（タイプ・期限・習慣・見積もり）も編集できるようにする
- 🎯 目標達成の褒めコメントを `praiseComment` サービスと統合してバリエーション化
- 再開後にもう一度 🔥 タイマーを動かしたとき、前回の workedMinutes を引き継ぐかリセットするかの仕様確認（現状は引き継ぐ＝累積）

## 2026-06-01: 今日のタスクタブで編集可能に（タイトル・タイプ・期限・習慣・見積もり）
**ブランチ:** claude/charming-goldberg-vT0zT

### 変更内容
- `src/store/taskStore.ts`: `updateTodayTask` アクションを追加。`text` / `type` / `due` / `isHabit` / `estimatedMinutes` / `estimateSource` / `timerMinutes` の部分更新を today タスクに対して行う
- `src/features/today/TodayTaskCard.tsx`:
  - タイトル行をタップで `TextInput` に切り替えて編集できるよう変更
  - 既存の固定タイプタグの代わりに `BadgeSelector` を使い、🔵/🔥 のタイプ、期限ラベル（今日/明日/いつか）、単発/習慣 を編集できるよう変更
  - 見積もり分数（`estimatedMinutes`）を編集する入力行を追加（インボックスタブと同じ操作感）。🔥 タイマー実行中は誤操作防止のため編集不可

### 変更意図・背景
従来、今日のタスクタブではタスク名・タイプ・期限・習慣・見積もりを編集する手段がなく、修正したい場合は一度インボックスに戻す必要があった。
ユーザーが今日のタスクタブ内で完結して編集できるようにすることで、再分類のためにインボックスに往復する手間をなくす。

### 技術的決定事項
- 既存の `BadgeSelector` をそのまま再利用（インボックスタブと UI 統一）
- 編集アクションは既存の `updateClassification`（inbox 向け）と分離して `updateTodayTask` を新設。inbox / today で対象配列が違うため処理を分けたほうが副作用が読みやすい
- タイトルは「タップで編集モード → blur で保存」方式（モーダルや別画面を作らずに済む）

### 残課題・次のステップ
- 🔥 沼タスクの `timerMinutes` はタイマー開始時に決定する仕様のままで、編集 UI からは触らない
- タイプ切り替え時に `shojikubai` / `shojikubaiEstimates` をリセットすべきかの仕様確認

## 2026-06-01: コンフリクト解消・バグ修正（中断時間積算・TierSelectModal改善）
**ブランチ:** claude/vigilant-albattani-nWlW1

### 変更内容
- `src/store/taskStore.ts`: `pauseBlueTask` で中断時に経過分数を `workedMinutes` に積算するよう修正（バグ修正）
- `src/store/taskStore.ts`: `completeShojikubai` で積算済み `workedMinutes` + 最終セグメントを合算して合計作業時間を算出（バグ修正）
- `src/features/today/TierSelectModal.tsx`: `shojikubai` prop 追加。各tierオプションにShojikubaiEditorで入力した行動内容テキストを表示
- `src/features/today/TodayTaskCard.tsx`: PR#14（ShojikubaiEditor・中断機能）とPR#15（TierEstimateRow・TierSelectModal）を統合

### 変更意図・背景
- PR#14とPR#15のコンフリクト解消
- 中断→再開→完了のフローで作業時間が正しく積算されていなかったバグを修正
- ShojikubaiEditorで書いた内容がTierSelectModalに反映されていなかった問題を修正

### 技術的決定事項
- `workedMinutes` を中間積算に兼用（pauseBlueTask で加算、completeShojikubai で追記）
- TierSelectModalは `shojikubai?.matsu` 等のコンテンツを sublabel にフォールバックとして使用

### 残課題・次のステップ
- 習慣タスクの「前回tier」を task.text でマッチングしているため、テキスト変更時に履歴が途切れる

## 2026-06-01: 松竹梅ごとの見積もり入力・完了時 tier 選択モーダル
**ブランチ:** claude/vigilant-albattani-nWlW1（初版）

### 変更内容
- `src/types/task.ts`: `ShojikubaiEstimates`型を追加（matsu/take/ume の見積もり分数を保持）、`Task`に`shojikubaiEstimates`フィールドを追加
- `src/db/index.ts`: `shojikubai_estimates` カラムのマイグレーションを追加
- `src/db/taskRepo.ts`: 新フィールドの insert/update/rowToTask 対応
- `src/store/taskStore.ts`: `updateShojikubaiEstimates`アクションを追加
- `src/features/today/TierSelectModal.tsx`（新規）: 完了時にどのtierを達成したか選ぶモーダル
- `src/features/today/TodayTaskCard.tsx`: 松竹梅の見積もり入力行（松は必須）を追加。ShojikubaiButtonsを「完了 →」ボタン＋TierSelectModalに変更
- `src/app/(tabs)/log.tsx`: DoneRowに見積もり分数表示を追加
## 2026-06-01: UIテーマ統一・コントラスト改善・タブ名変更・タイマー表示強化
**ブランチ:** claude/peaceful-brahmagupta-YlucS

### 変更内容
- `src/app/(tabs)/_layout.tsx`: タブ名を「吐き出し→タスク掃き出し」「今日→今日のタスク」に変更
- `src/app/(tabs)/index.tsx`: SafeAreaView に `backgroundColor: colors.bgTop` を追加（ダークテーマ統一）
- `src/app/(tabs)/log.tsx`: SafeAreaView に `backgroundColor: colors.bgTop` を追加（ダークテーマ統一）
- `src/components/ui/Bubble.tsx`: 🔥バブルを明るいグラデーション背景からダーク背景+ボーダーに変更（コントラスト改善）
- `src/features/today/BrakeTimer.tsx`: タイマー実行中に「経過時間 MM:SS」と「残り時間 MM:SS」を並列表示する UI を追加

### 変更意図・背景
- 「今日」タブのみダークテーマが適用されており、「タスク掃き出し」「ほめログ」タブが白背景になっていた
- 🔥バブル（ChatList の火タスク分類カード）が明るいオレンジ/赤グラデーション背景に暗色テキストを重ねており、コントラスト比が不十分だった
- 沼タスク実行中に経過時間が表示されず、どのくらい作業したか把握しにくかった

### 技術的決定事項
- 🔥バブルは `gradients.fire`（明るい赤オレンジグラデ）→ `rgba(255,90,110,0.12)` の半透明ダーク背景 + ボーダーに変更。テキストカラーは既存のダークテーマ向けカラーをそのまま維持できる
- 経過時間は `useCountdown` が返す `remainingMs` から `totalMs - remainingMs` で導出。新規 state 不要
- 経過/残りを左右2セルで表示し、区切り線で視覚的に分離

### 残課題・次のステップ
- ActiveSessionBanner（今日タブ上部バナー）にも経過時間を表示すると一貫性が高まる

## 2026-06-01: 細かい4点修正（松竹梅入力・中断機能・沼アラート確認・TODO表示変更）
**ブランチ:** claude/sleepy-faraday-niOxM

### 変更内容
- `src/features/today/ShojikubaiEditor.tsx` (新規): 松竹梅（梅/竹/松）の行動内容を入力するフォームコンポーネント
- `src/features/today/TodayTaskCard.tsx`: ShojikubaiEditor を🔵タスクカードに追加。「動けるタスク」→「TODO」に表示変更
- `src/features/today/StartTaskButton.tsx`: 作業中に「⏸ 中断」ボタンを追加。中断後は「🚀 再開」ボタンを表示
- `src/features/today/BrakeTimer.tsx`: 🔥タスクのタイマー実行中に「⏸ 中断」ボタンを追加（完了ではなく一時停止）
- `src/store/taskStore.ts`: `pauseBlueTask`・`updateShojikubai` アクション追加、`startBlueTask` を再開可能に修正
- `src/features/inbox/TaskBubble.tsx`: TYPE_OPTIONS の「🔵 動ける」→「🔵 TODO」に変更

## 2026-06-01: 褒めログ UI 再設計 — ルールベース褒めコメント実装
**ブランチ:** claude/amazing-brahmagupta-ov0FY

### 変更内容
- `src/services/praiseComment.ts` (新規):
  - 外部AI不使用のルールベース褒めコメント生成ロジック
  - 入力: 完了タスク数・合計作業分数・松竹梅別カウント・🔥タスク数
  - `headline`（短い称賛見出し）・`subline`・`comment`（1段落の褒め文）を返す
  - 優先順位: 松達成 > 🔥過集中ブレーキ > 梅のみ > 長時間 > 多タスク > デフォルト
- `src/app/(tabs)/log.tsx`:
  - ヒーローセクション再設計: 「合計 XX分」大数字 + 見出し + サブライン
  - 達成状況ドット（最大5スロット、松竹梅・🔥・空をカラーで可視化）
  - タスク行に`[梅][竹][松][🔥]`カラーラベルを先頭に配置
  - 🔥タスクで時間内完了時に「過集中回避！」バッジを表示
  - 褒めコメントカードをスクロール最下部に追加
  - シェア機能を右上アイコンに移動し、スクロール外に出す

### 変更意図・背景
画像デザイン案に基づき「できた事実だけを最大化して褒める」設計を実装。
外部API不使用で完了データのみからルール分岐しコメントを生成するため、オフライン動作・コスト0・確定的な文章品質を実現。

### 技術的決定事項
- AIコメントではなくルールベースを選択: 初回実装でAPIコスト・レイテンシ・エラー処理を排除
- headline/subline/comment の3層構造: 将来AI強化時も同インターフェース維持
- 松竹梅カラーはテーマ外で定義（`#3DD68C` / `#FF8A4C` / `#FFD600`）: 既存テーマの青・紫・赤と区別が必要

### 残課題・次のステップ
- 褒めコメントのバリエーション増加（同じ状況で複数パターンをランダム選択）
- 松竹梅ドットのアニメーション（完了時に光る演出）
- 将来的なAI生成コメントへの差し替え（インターフェースは維持済み）
## 2026-06-01: 掃き出しUI細修正3点（Enter送信・分類引き継ぎ・時間見積もり入力）
**ブランチ:** claude/vigilant-babbage-Phtdh

### 変更内容
- `src/features/inbox/InputBar.tsx`: PC（isDesktop）では `multiline={false}` にし、Enterキーで送信できるように変更（LINEのPC UIと同様の動作）
- `src/store/taskStore.ts`:
  - `addTask` で直前タスクの分類（type/due/isHabit）を引き継ぐように変更。当日以前のタスクしかない・タスクが空の場合はデフォルト（動ける/今日/単発）を使用
  - `updateClassification` で type/due/isHabit 以外の変更（見積もりなど）をしたとき `classifySource` を不必要に 'manual' に上書きしないよう修正
- `src/types/task.ts`: `ClassificationPatch` に `estimatedMinutes` と `estimateSource` を追加
- `src/features/inbox/TaskBubble.tsx`: 各タスクの分類カードに⏱ 見積もり（分）入力欄を追加。入力確定時（blur/Enterキー）にDBへ保存

### 変更意図・背景
- PCで使うときEnterで送信できないのが不便だった（改行が入ってしまう）
- タスクを大量吐き出しするとき、毎回同じ分類を手動設定し直すのが手間だった。前回分類を引き継ぐことで摩擦を減らす
- 掃き出し段階で時間の見積もりも入れておきたいというニーズに対応

### 技術的決定事項
- Enter送信はPC（isDesktop=true）のみ有効。モバイルは引き続き multiline で改行可能
- 分類引き継ぎは「当日のタスク」の最後のもの（`.at(-1)`）から取得。日またぎは引き継がず、デフォルトに戻す
- AIが分類した場合（result.type/result.due が非null）はAI結果を優先し、フォールバックは使わない
- 見積もり入力はフリーテキスト（数値）でblur/Enterで確定。バリデーション：正の整数のみ保存、空欄でクリア

### 残課題・次のステップ
- モバイルでもShift+Enterで改行する実装（現状はmultilineのままなのでモバイルは問題なし）
- 見積もりのプリセットボタン（5分/15分/30分/60分）があると入力が楽かもしれない

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
