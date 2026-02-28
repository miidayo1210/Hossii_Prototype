# スペース（HOME）詳細仕様書

## 現在の実装状況（ベースライン）

- 表示上限: `state.displayLimit`（デフォルト50件、LeftControlBar から変更可）
- バブル座標: index × シード値によるdeterministicランダム配置（画面端 8%〜92% / 12%〜78% の範囲）
- Supabase Realtime: hossiis の INSERT / DELETE を既に購読済み
- デバイス分岐: モバイル → StarView、デスクトップ → Bubble
- 表示スケール: 100% / 125% / 150% の3段階（LeftControlBar）
- 表示期間フィルタ: 1日/1週/1月/全期間（LeftControlBar、デフォルト1週間）
- 表示モード: フル / バブル / 画像のみ の3種類（LeftControlBar）
- 吹き出し絵文字: バブル上部の大アイコンとして表示（コメント内には重複しない）

---

## 1. 表示フィルタ・設定

### F11 表示期間フィルタ（1日/1週/1ヶ月/全期間）

> **✅ 実装済み**

**概要**: スペースに表示する投稿を期間で絞り込む。

**対象**: スペース表示（ユーザー）

**UIコンポーネント**:
- LeftControlBar の「期間」セクションに 4 つのミニボタン: `1日` / `1週` / `1月` / `全期`
- 現在選択中をグラデーションハイライト

**データ仕様**:
- フィルタはフロントエンドのみ（Supabase クエリは変更なし）
- Supabase Realtime の購読は期間フィルタと独立（新着は常に受信し、フィルタ条件に合う場合のみ表示）
- デフォルト: `1w`（直近1週間）
- 保存先: `localStorage['hossii.displayPeriod']`

**状態管理**:
```ts
type DisplayPeriod = '1d' | '1w' | '1m' | 'all';
// useHossiiStore の state.displayPeriod
// setDisplayPeriod(period) で変更
```

**実装ファイル**: `src/core/utils/displayPrefsStorage.ts`・`useHossiiStore.tsx`・`SpaceScreen.tsx`・`LeftControlBar.tsx`

---

### F12 表示件数の選択（50/100/150/無制限）

> **✅ 実装済み**

**概要**: 一度に表示する最大投稿件数を選択できる。

**対象**: スペース表示（ユーザー）

**UIコンポーネント**:
- LeftControlBar の「件数」セクションに 4 つのミニボタン: `50` / `100` / `150` / `∞`
- 現在選択中をグラデーションハイライト

**データ仕様**:
- 旧定数 `MAX_DISPLAY_COUNT = 40` を廃止し `state.displayLimit` に置き換え
- デフォルト: `50`
- 保存先: `localStorage['hossii.displayLimit']`

**状態管理**:
```ts
type DisplayLimit = 50 | 100 | 150 | 'unlimited';
// useHossiiStore の state.displayLimit
// setDisplayLimit(limit) で変更
```

**実装ファイル**: `src/core/utils/displayPrefsStorage.ts`・`useHossiiStore.tsx`・`SpaceScreen.tsx`・`LeftControlBar.tsx`

---

## 2. 表示モード

### F03 左バーで表示モード切替（3パターン）

> **✅ 実装済み**

**概要**: スペースの表示スタイルを3種類から選択できる。

**対象**: スペース表示（ユーザー）

**UIコンポーネント**:
- LeftControlBar の「表示」セクションに 3 つのミニボタン: `📝` フル / `💬` バブル / `🖼` 画像のみ

**モード定義**:

| モードID | 名称 | 表示内容 |
|---|---|---|
| `full` | フル表示 | コメント + 投稿者名 + 気持ちアイコン + 画像 + ハッシュタグ（デフォルト） |
| `bubble` | バブル表示 | 気持ちアイコン + 投稿者名・時間のみ（テキスト・画像・ハッシュタグ非表示） |
| `image` | 画像のみ | `imageUrl` がある投稿のみ表示、バブル内に画像だけレンダリング（テキスト・絵文字・ハッシュタグ非表示）。バブルの座標・アニメーションはそのまま維持 |

**データ仕様**:
- `image` モード選択時は `displayHossiis` 内で `imageUrl` のない投稿を事前フィルタ
- 保存先: `localStorage['hossii.viewMode']`（端末ごと）

**状態管理**:
```ts
type ViewMode = 'full' | 'bubble' | 'image';
// useHossiiStore の state.viewMode
// setViewMode(mode) で変更
```

**実装ファイル**: `src/core/utils/displayPrefsStorage.ts`・`useHossiiStore.tsx`・`SpaceScreen.tsx`・`Tree.tsx`・`LeftControlBar.tsx`

**絵文字の表示仕様**:
- 気持ち絵文字は吹き出し上部の `.bubbleEmoji` スパンにのみ表示（大アイコン）
- コメントテキスト（`.bubbleText`）には絵文字を含まない `message` の文字列のみを表示（重複なし）
- `renderHossiiText()` は絵文字+メッセージを結合するが、Bubble コンポーネントでは `hossii.message` を直接使用

---

## 3. 吹き出しの編集・配置

### F14 投稿選択UI（編集モードの導線）

**概要**: 吹き出しに対して編集操作（移動・リサイズ・非表示）を行うための選択モード。

**対象**: スペース表示（ユーザー / 管理者）

**UX フロー**:
1. 通常モード → 吹き出しを**1クリック**で選択モードへ移行（紫色ハイライト枠 + 4コーナーハンドル表示）
2. 選択中の吹き出し**本体をドラッグ** → そのまま移動（PointerUp で即座に保存）
3. 選択中の**コーナーハンドルをドラッグ** → リサイズ（PointerUp で即座に保存）
4. 吹き出し外をクリック or `Escape` キー → 選択解除
5. 管理者のみ: 画面下部ツールバーに「🚫 非表示」ボタンが表示される

**実装メモ**:
- `Bubble` コンポーネントが内部で native pointer events（`addEventListener`）を管理
- `document` レベルの `pointermove` / `pointerup` で要素外に出てもドラッグ継続
- ドラッグ中の座標は `Bubble` 内部 state で管理し、`PointerUp` 時のみ親コールバック呼び出し（State フラッディング回避）
- `SpaceScreen` の `selectedBubbleId` state のみで選択を管理（`editMode` / `dragPosition` 等は不要）

**状態管理**:
```ts
// SpaceScreen の local state
selectedBubbleId: string | null;
// Bubble 内部の local state
dragPos: { x: number; y: number } | null;
dragScale: number | null;
```

**選択解除トリガー**:
- バブルエリアの背景クリック（`!target.closest('[data-hossii-bubble]')`）
- `Escape` キー
- 「✕ 選択解除」ボタン（ツールバー）

---

### F02 吹き出し座標の固定（ランダム→固定）

**概要**: 現在はindex×シード値で生成しているランダム座標を、ユーザーが明示的に固定できるようにする。

**対象**: スペース表示（ユーザー or 管理者）

**現状の実装**:
- `createBubblePosition(index)` で計算（deterministic だがユーザー変更不可）

**実装済み仕様**:
- `hossii.isPositionFixed === true` かつ `positionX / positionY` が設定済みの場合 → その値を使用
- 未設定（null）の場合 → 現行の index シード計算にフォールバック
- F04 でドラッグ保存すると `is_position_fixed = true` になる

**データスキーマ**:
```sql
ALTER TABLE hossiis ADD COLUMN position_x float DEFAULT NULL;
ALTER TABLE hossiis ADD COLUMN position_y float DEFAULT NULL;
ALTER TABLE hossiis ADD COLUMN is_position_fixed boolean DEFAULT false;
```

**権限**: スペース設定の `bubbleEditPermission` に従う（下記参照）

---

### F04 吹き出し編集（位置移動→保存）

**概要**: 選択中の吹き出しをドラッグ操作で移動し即座に保存する。

**対象**: スペース表示（ユーザー or 管理者）

**UX**:
- F14 で選択 → 吹き出し本体（コーナーハンドル以外）をドラッグ → 移動
- PointerUp 時に即座に `hossiis.position_x / position_y / is_position_fixed` を UPDATE（「確定」ボタン不要）
- ドラッグ中はアニメーション停止（`animationPlayState: paused`）

**権限**: スペース設定の `bubbleEditPermission` に従う（下記参照）

**DB操作**:
```ts
supabase.from('hossiis')
  .update({ position_x: x, position_y: y, is_position_fixed: true })
  .eq('id', hossiiId)
```

---

### F05 吹き出し編集（サイズ変更→保存）

**概要**: 選択中の吹き出しのコーナーハンドルをドラッグしてリサイズし即座に保存する。吹き出し全体（枠・テキスト・画像を含む）がスケールされる。

**対象**: スペース表示（ユーザー or 管理者）

**UX**:
- F14 で選択 → 4コーナーの丸ハンドルをドラッグ → リサイズ
- 右下・右上 = 拡大方向 / 左上・左下 = 縮小方向（対角ドラッグ量で計算）
- PointerUp 時に即座に `hossiis.scale` を UPDATE（「確定」ボタン不要）
- スケール範囲: 0.5 〜 2.5
- ドラッグ中はリアルタイムでプレビュー（ローカル state で管理）

**スケール適用対象**:
- 吹き出しコンテナ（`.bubble`）全体に CSS `scale` プロパティを適用
- テキスト・絵文字・画像・ハッシュタグチップすべて含む吹き出し全体が拡大/縮小する
- `transform: translateY` アニメーションとは独立して動作（干渉しない）

**実装メモ**:
```ts
// bubbleStyle に直接 scale を設定（CSS scale プロパティ）
bubbleStyle.scale = String(displayScale);
// ← transform は float アニメーション用のため上書きしない
```

**データスキーマ**:
```sql
ALTER TABLE hossiis ADD COLUMN scale float DEFAULT 1.0;
```

---

### バブル編集権限（F02/F04/F05 共通）

> **✅ 実装済み**

**概要**: F02（座標固定）/ F04（移動）/ F05（リサイズ）/ F01（色変更）の編集権限を、スペース設定で制御できる。

**設定場所**: `SpaceSettingsScreen` > 基本設定 > 「バブル編集権限」

| 設定値 | 内容 |
|---|---|
| `all`（デフォルト） | 全参加者が移動・リサイズ・色変更可能 |
| `owner_and_admin` | 投稿者本人と管理者のみ編集可能 |

**状態管理**:
```ts
// SpaceSettings に追加
bubbleEditPermission: 'all' | 'owner_and_admin'; // デフォルト: 'all'
```

**実装ファイル**: `src/core/types/settings.ts`・`SpaceSettingsScreen/GeneralTab.tsx`・`SpaceScreen.tsx`・`Tree.tsx`

---

### F06 吹き出し非表示（Hide）

**概要**: 荒らし対策や整理のため、管理者が投稿を非表示にできる。

**対象**: スペース表示（管理者）

**UX**:
- F14の編集モードツールバーに「非表示」ボタン
- 非表示後: その吹き出しはスペースから消える（投稿者含む全ユーザーに非表示）

**データスキーマ変更**:
```sql
ALTER TABLE hossiis ADD COLUMN is_hidden boolean DEFAULT false;
```

**フロントエンド**:
- `displayHossiis` フィルタに `!hossii.isHidden` を追加

**監査**:
- 管理者画面で `is_hidden = true` の投稿を一覧表示し、復元（`is_hidden = false` に戻す）できる

---

## 4. 投稿の作成・編集（投稿画面）

### F01 吹き出し色の選択・変更

**概要**: 投稿時および投稿後（スペース上で選択時）に吹き出しの色を選択・変更できる。

**対象**: 投稿画面（ユーザー） / スペース表示（ユーザー）

**① 投稿時の色選択（PostScreen）**:
- 8色のプリセットカラーパレットを表示
- 選択色が投稿フォームのプレビューに即時反映
- 投稿データに `bubble_color` として保存

**② スペース上での色変更（SpaceScreen · F14と連動）**:
- 吹き出しを**1クリック**で選択すると、吹き出しの**上部にカラーパレットがポップアップ**表示される
- 8色のプリセット + 「✕」（デフォルト色に戻す）ボタン
- スウォッチをタップ/クリックすると即座に色が変わり、DB に自動保存（確定ボタン不要）
- 現在選択中の色には紫色のボーダーで強調表示

**プリセット 8色**:
```
#FFB3B3（淡レッド）/ #FFD9B3（淡オレンジ）/ #FFFAB3（淡イエロー）/ #B3FFB8（淡グリーン）
#B3E0FF（淡ブルー）/ #D9B3FF（淡パープル）/ #FFB3E6（淡ピンク）/ #FFFFFF（ホワイト）
```

**データスキーマ変更**:
```sql
ALTER TABLE hossiis ADD COLUMN bubble_color varchar(7) DEFAULT NULL; -- "#FF6B6B" 形式
```

**型定義追加**:
```ts
// Hossii 型に追加
bubbleColor?: string; // CSS color value
```

**DB 更新 API**:
```ts
supabase.from('hossiis')
  .update({ bubble_color: color })  // null でデフォルト色に戻す
  .eq('id', hossiiId)
```

---

### F09 ハッシュタグ付与

**概要**: 投稿にハッシュタグを付けて、フィルタ・検索・集計に活用する。

**対象**: 投稿画面（ユーザー）

**UI**:
- テキスト入力内で `#` を入力するとパース、またはタグ入力コンポーネント
- 入力済みタグはチップ（pill）形式で表示 + 削除ボタン

**データスキーマ変更**:
```sql
ALTER TABLE hossiis ADD COLUMN hashtags text[] DEFAULT '{}';
```

**型定義追加**:
```ts
// Hossii 型に追加
hashtags?: string[]; // e.g. ["朝会", "チーム"]
```

**将来の活用**:
- スペース内フィルタ（F11と連携）
- 管理者ダッシュボードでのタグ別集計

---

### F10 画像投稿

**概要**: テキストの代わりまたは組み合わせで画像を投稿できる。

**対象**: 投稿画面（ユーザー）

**UI**:
- 投稿フォームにカメラ/アルバムボタン
- プレビュー表示（アップロード前）

**データ仕様**:
- Supabase Storage: `hossii-images/{spaceId}/{hossiiId}.jpg` に保存
- DB: `hossiis.image_url` に Storage の公開 URL を保存

**データスキーマ変更**:
```sql
ALTER TABLE hossiis ADD COLUMN image_url text DEFAULT NULL;
```

**最適化**:
- アップロード前にクライアント側で圧縮（最大 1MB / 1280px）
- Supabase Storage の Transform API でサムネイル生成

---

### F08 指で描いた絵をそのまま投稿（お絵描き）

**概要**: キャンバスに指/ペンで描いた絵を PNG として保存し、画像投稿として送信。

**対象**: 投稿画面（ユーザー）

**UIコンポーネント**:
- `<canvas>` 要素（全画面 or モーダル内）
- ツールバー: ペン色・太さ・消しゴム・undo・クリア・送信

**出力フロー**:
1. `canvas.toBlob('image/png')` でバイナリ生成
2. F10の画像投稿フローで Supabase Storage へアップロード

**スマホ最適化**:
- タッチイベント（`touchstart / touchmove / touchend`）を優先
- `touch-action: none` で意図しないスクロールを防止

---

## 5. スペース上の特殊機能

### F07 Hossii（キャラ）：投稿をランダムに拾って読み上げ

> **✅ 実装済み**

**概要**: Hossii キャラクターが一定間隔でランダムに投稿を拾い、吹き出し表示 + 音声で読み上げる。

**対象**: スペース表示（ユーザー）

**動作フロー**:
1. 30〜60秒のランダム間隔で idle speech タイマーが発火（既存ロジック）
2. 40% の確率で発動する
3. 発動時: `readingEnabled=true` かつ表示中投稿が存在する場合、50% の確率で投稿読み上げを選択
   - 候補: `displayHossiis` の中からテキストが空でない投稿（直前に読んだ ID は除外）
   - ランダム1件を選び、吹き出しに `「テキスト」` 形式で表示（最大40文字 + 省略記号）
   - Web Speech API (`SpeechSynthesis`) で音声読み上げ（言語: `ja-JP`、speed: 1.0、pitch: 1.1）
4. 残り 50% は従来通りハードコード `HOSSII_IDLE_LINES` から発話

**ON/OFF**: LeftControlBar の 🔊 ボタン（`voiceEnabled`）で兼用。OFF 時は `speechSynthesis.cancel()` を即時実行。

**実装ファイル**: `src/components/Hossii/HossiiLive.tsx`（`hossiis` / `readingEnabled` props 追加）・`SpaceScreen.tsx`

**将来の拡張**:
- NGワード辞書との照合
- 読み上げ間隔・音量のカスタマイズ設定
