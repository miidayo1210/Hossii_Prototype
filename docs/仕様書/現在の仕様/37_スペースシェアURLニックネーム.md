# スペースシェアURL ニックネーム入力画面仕様

## 概要

スペースのシェアURL（`/s/slug` または `/c/community/s/slug`）を開いたとき、
ユーザーはニックネームを入力して入室する。この画面の UX を改善する。

---

## 入室フロー（2種類）

| 状況 | 使用コンポーネント |
|---|---|
| 未ログインユーザーが `/s/slug` にアクセス | `GuestEntryScreen` |
| ログイン済みユーザーがニックネーム未設定スペースに入室 | `NicknameModal`（スペース画面の上に重なるモーダル） |

---

## 現状の UI

### `GuestEntryScreen`（未ログインユーザー向け）

1. **Step1（select）**: 「ゲストとして参加」か「アカウントでログイン」を選ぶ
2. **Step2（nickname）**: テキスト入力 → 「入室する」ボタン

### `NicknameModal`（ログイン済みユーザー向け）

- 「このスペースでのニックネーム」というタイトルのモーダル
- テキスト入力 → 「決定」ボタン

---

## 問題1: オートコンプリートにカード番号などが表示される

### 原因

両コンポーネントの `<input>` に `autoComplete` 属性が未設定。  
ブラウザがローカルに保存した過去の入力値（カード番号・住所等）を候補として表示してしまう。

- `GuestEntryScreen.tsx` L70: `<input type="text" className={styles.nicknameInput} ...>`
- `NicknameModal.tsx` L31: `<input type="text" className={styles.input} ...>`

### 対応

両 `<input>` に以下を追加する：

```tsx
autoComplete="off"
```

---

## 問題2: Hossiiキャラのウェルカム UI にしたい

### 現状

`GuestEntryScreen` は「✨ Hossii」ロゴ + 「「スペース名」に参加する」のテキストのみ。  
キャラクター表示・吹き出しUIはない。

### 仕様

- ニックネーム入力ステップ（GuestEntryScreen Step2 と NicknameModal）に、
  Hossiiキャラの吹き出し形式でウェルカムメッセージを表示する
- デフォルトのセリフ: 「（スペース名）にようこそ！ニックネームを入力してね。」
- キャラクター画像は `Space.characterImageUrl`（既存フィールド）を使用
  - 未設定時は ✨ などのデフォルトアイコンで代替

### UI イメージ（ニックネーム入力ステップ）

```
  ┌─────────────────────────────────┐
  │                                 │
  │     [Hossiiキャラ画像]           │
  │                                 │
  │   ┌─────────────────────────┐   │
  │   │ 「朝のスペース」に        │   ← 吹き出し
  │   │ ようこそ！              │
  │   │ ニックネームを           │
  │   │ 入力してね。             │
  │   └─────────────────────────┘   │
  │                                 │
  │   [ニックネーム入力欄]           │
  │   [入室するボタン]               │
  │   [戻るリンク]                  │
  └─────────────────────────────────┘
```

---

## 問題3: スペース設定でウェルカムメッセージを登録したい

### 仕様

管理者がスペース設定でウェルカムメッセージを自由に入力できるようにする。  
設定されたセリフを Hossii キャラが吹き出しで話す。

#### `Space` 型への追加

```ts
welcomeMessage?: string;  // 入室時ウェルカムメッセージ（未設定時はデフォルト文言）
```

#### 表示優先度

```
welcomeMessage が設定されている
  → そのまま吹き出しに表示（例: 「今日も元気でね！」）

welcomeMessage が未設定
  → デフォルト: 「{spaceName}にようこそ！ニックネームを入力してね。」
```

#### スペース設定 UI（`GeneralTab`）に追加する項目

| 項目名 | 入力形式 | 上限 |
|---|---|---|
| ウェルカムメッセージ | テキストエリア | 100文字 |

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/components/Auth/GuestEntryScreen.tsx` | `autoComplete="off"` 追加・Hossiiキャラ吹き出しUI追加・`welcomeMessage` 表示 |
| `src/components/NicknameModal/NicknameModal.tsx` | `autoComplete="off"` 追加・Hossiiキャラ吹き出しUI追加・`welcomeMessage` 表示 |
| `src/core/types/space.ts` | `welcomeMessage?: string` を `Space` 型に追加 |
| `src/components/SpaceSettingsScreen/GeneralTab.tsx` | ウェルカムメッセージ入力欄を追加 |
| `src/core/utils/spacesApi.ts` | `welcome_message` カラムの読み書き対応 |
| Supabase `spaces` テーブル | `welcome_message text` カラムを追加（ダッシュボードで実行） |

---

## Supabase マイグレーション SQL

```sql
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS welcome_message text;
```
