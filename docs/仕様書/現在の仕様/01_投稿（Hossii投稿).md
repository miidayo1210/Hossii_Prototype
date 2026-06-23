# 投稿（Hossii 投稿）仕様

> **分類:** `[Core]` 全スペース共通の投稿データ型・送信フロー
> **関連:** [core-concepts.md](../../core/core-concepts.md) §2（Hossii型）

> 最終更新: 2026-02-23
> 関連ファイル: `src/components/PostScreen/PostScreen.tsx`, `src/core/hooks/useHossiiStore.tsx`, `src/core/types/index.ts`

---

## 概要

投稿画面（`#post`）から「気持ち（感情）」や「メッセージ」をスペースに置く機能。
置かれた投稿はスペースビュー（`#screen`）にバブル／スターとして表示される。

---

## 投稿データ型

```ts
type Hossii = {
  id: string;               // 一意ID（自動生成）
  message: string;          // テキストメッセージ（空文字もあり）
  emotion?: EmotionKey;     // 感情（任意）
  spaceId: string;          // 所属スペースID
  authorId?: string;        // 投稿者ID（端末固有）
  authorName?: string;      // 投稿者名（表示用）
  createdAt: Date;          // 投稿日時
  origin?: HossiiOrigin;    // 発生元: 'manual' | 'auto'（未設定はmanual扱い）
  autoType?: AutoType;      // 自動投稿の種類: 'emotion' | 'speech' | 'laughter'
  speechLevel?: SpeechLevel;// 音声粒度: 'word' | 'short' | 'long'
  language?: LanguageCode;  // 言語: 'ja' | 'en' | 'unknown'（自動投稿のみ）
  logType?: LogType;        // 後方互換用: 'emotion' | 'speech'
};
```

---

## 投稿種別

| origin | autoType | 説明 |
|--------|----------|------|
| `manual`（未設定含む） | — | 投稿画面からの手動投稿 |
| `auto` | `emotion` | 音響分析による感情の自動検出 |
| `auto` | `speech` | 音声認識によるテキストの自動投稿 |
| `auto` | `laughter` | 笑い声の自動検出（メッセージなし） |

---

## 手動投稿の仕様

### 入力フィールド

| フィールド | 必須 | 上限 | 制御 |
|-----------|------|------|------|
| メッセージ（textarea） | スペース設定で任意/必須 | 200文字 | `postFields.message`（`enabled` / `required`） |
| 感情選択（クイック感情バー） | スペース設定で任意/必須 | 1つ（トグル） | `postFields.emotion` |
| タグ（プリセット + ハッシュタグ） | スペース設定で任意/必須 | — | `postFields.tags` |
| 吹き出し色 | スペース設定で任意/必須 | — | `postFields.bubbleColor` |
| 吹き出し形状 | スペース設定で任意/必須 | — | `postFields.bubbleShape` + `bubble_shapes_extended` Feature Flag |
| 写真添付 | スペース設定で任意/必須 | — | `postFields.photo` |
| 数値入力 | スペース設定で任意/必須 | — | `postFields.numberPost` |

> PostScreen は `resolvePostFields(spaceSettings)` の結果のみ参照する。`postFields` が未設定の旧データは `features.*` から表示 ON/OFF を導出（必須はすべて OFF）。詳細は [86_投稿フォーム項目設定](./86_投稿フォーム項目設定.md)。

### 送信可否条件

```
allRequiredSatisfied（各 enabled かつ required の項目が充足）
AND hasAnyInput（enabled な項目のいずれかに入力がある）
→ 送信ボタン有効
```

必須未充足で投稿ボタン押下時: 対象フィールドに赤枠 + エラーメッセージ（入力中は赤くならない）。

いずれも満たさない場合（入力なし）: `「気持ち・メッセージ・写真・数値のいずれかを入力してね！」` エラートーストを表示。

### 送信処理フロー

```
1. canSubmit チェック（emotion または message）
2. addHossii({ message, emotion }) を呼び出し
3. スタンプ +1（currentUser が存在する場合）
   - 累計スタンプが 20 の倍数 → 「スタンプカードが完成したよ！」トースト
   - それ以外 → 「${emoji} ${label} を置いたよ！⭐ スタンプ+1」トースト
4. フォームをリセット（emotion・message・画像プレビューをクリア）
5. セリフをシャッフル
6. 800ms 後にスペースビュー（#screen）へ遷移
```

### 送信者名の決定ロジック

```
スペース固有ニックネーム（spaceNicknames[activeSpaceId]）
  ↓ なければ
デフォルトニックネーム（profile.defaultNickname）
  ↓ なければ
undefined（名前なしで投稿）
```

---

## 感情（EmotionKey）

8種類。スペースごとに表示する感情の組み合わせを設定可能（`quickEmotions`）。

| key | 絵文字 | ラベル |
|-----|--------|--------|
| `wow` | 😮 | Wow |
| `empathy` | 😍 | 刺さった |
| `inspire` | 🤯 | 閃いた |
| `think` | 🤔 | 気になる |
| `laugh` | 😂 | 笑った |
| `joy` | 🥰 | うれしい |
| `moved` | 😢 | ぐっときた |
| `fun` | ✨ | 楽しい |

- 同じ感情を再タップ → 選択解除（トグル動作）
- 選択中は選択済みスタイルで強調表示

---

## スペース機能フラグ（SpaceFeatures）

> **投稿パネルの表示制御:** PostScreen は [86_投稿フォーム項目設定](./86_投稿フォーム項目設定.md) の `postFields` を優先する。以下の `features.*` は GeneralTab に残存し、`postFields` 未設定時のフォールバックにのみ使用される。

スペースごとに投稿フォームの各セクションを有効/無効にできる（レガシー）。

| フラグ | デフォルト | 制御対象（フォールバック） |
|--------|-----------|---------------------------|
| `commentPost` | `true` | メッセージ入力欄 |
| `emotionPost` | `true` | クイック感情バー |
| `photoPost` | `true` | 写真添付エリア |
| `numberPost` | `false` | 数値入力（数値投稿） |

`postFields` 設定時は全 7 項目の enabled が OFF の場合、「このスペースでは投稿機能が無効になっています」と警告表示。

---

## 空投稿の防止ロジック（ストア側）

`ADD_HOSSII` アクション内で以下の条件を満たさない場合は追加しない：

```ts
// emotion も message も無い場合はスキップ
// ただし autoType === 'laughter' は空メッセージを許可
if (!emotion && !msg && !isLaughter) return state;
```

---

## UI構成

```
PostScreen
├── HossiiToggle（左上：Hossii表示切替）
├── TopRightMenu（右上：メニュー）
├── header（showHossii=true のときのみ表示）
│   ├── HossiiMini（キャラクター・タップでセリフシャッフル）
│   └── greeting（ランダムセリフ）
└── main
    ├── h2「気持ちを置く 🌸」
    ├── 投稿無効通知（postFields 全項目 OFF のとき）
    ├── メッセージ入力（postFields.message.enabled）
    ├── クイック感情バー（postFields.emotion.enabled）
    │   └── 選択中の感情ヒント表示
    ├── 吹き出し色（postFields.bubbleColor.enabled）
    ├── 吹き出し形状（postFields.bubbleShape.enabled + bubble_shapes_extended）
    ├── タグ（postFields.tags.enabled）
    ├── 数値入力（postFields.numberPost.enabled）
    ├── 写真添付（postFields.photo.enabled）
    └── 送信ボタン「気持ちを置く」（必須充足 + 入力あり）
        └── sending中は「送信中...」・disabled
```

---

## セリフプール（Hossiiのグリーティング）

投稿画面表示時・送信後にランダム表示。

- 今日もいっしょに輝こう ⭐️
- 来てくれてうれしすぎる〜〜！！
- ワクワクをひとつ、置いてってね！
- なんか、いいこと起きそうな予感…！
- 気持ちボタンを押すだけでもいいんだよ〜✨
- ぽちっとするだけで場が広がるよ〜🌸
- 君の一声が、誰かを救うんだよ〜！📣

---

## データ永続化

- 投稿は `addHossii()` → `ADD_HOSSII` reducer → `saveHossiis()` → `localStorage` に同期保存
- 他タブの localStorage 変更は `storage` イベント経由で `SYNC_HOSSIIS` アクションにより同期

---

## 実装済み追記

- 写真添付: Supabase Storage へのアップロード・保存 → ✅ 実装済み（`imageStorageApi.ts`）
- `numberPost`: 数値投稿（数値入力 UI + Hossii.numberValue フィールド）→ ✅ 実装済み
- F08 お絵描き投稿: DrawingModal（canvas + ツールバー + undo）→ ✅ 実装済み
- 投稿フォーム項目設定（`postFields`）: 表示/必須制御 → ✅ 実装済み（[86](./86_投稿フォーム項目設定.md)）
