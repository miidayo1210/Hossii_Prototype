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

## 問題1: オートコンプリートにカード番号などが表示される ✅ 修正済み

### 原因

ニックネーム入力欄にブラウザ向けの属性が不十分だった。  
PC の Chrome / Edge などが、氏名・カード名義などの保存済み入力を候補として表示してしまう。

### 対応（実装済み）

`src/core/utils/nicknameInputProps.ts` に共通属性 `nicknameInputAntiAutofillProps` を定義し、  
ニックネーム入力のある全画面の `<input>` にスプレッドで適用する。

| 属性 | 値 | 目的 |
|------|-----|------|
| `autoComplete` | `off` | ブラウザの自動入力を無効化 |
| `name` | `hossii-nickname` | `name` / `nickname` など標準名で氏名・カード欄と誤認されないよう非標準名にする |
| `autoCorrect` | `off` | 入力補正の提案を抑制 |
| `spellCheck` | `false` | スペルチェックの提案を抑制 |
| `data-form-type` | `other` | フォーム種別の誤検知を抑制 |
| `data-lpignore` | `true` | パスワードマネージャー等の誤検知を抑制 |

**適用コンポーネント:**

| コンポーネント | 用途 |
|----------------|------|
| `GuestEntryScreen` | ゲスト入室時のニックネーム入力 |
| `NicknameModal` | ログイン済み・ニックネーム未設定時 |
| `OnboardingModal` | 一般ユーザー初回登録（`<form autoComplete="off">` も付与） |
| `ProfileScreen` | デフォルト / スペース別ニックネーム編集 |
| `AccountScreen` | デフォルト / スペース別ニックネーム編集 |

> `autoComplete="new-password"` のハックは廃止。上記の組み合わせで PC のカード・氏名提案を抑止する。

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
| `src/core/utils/nicknameInputProps.ts` | ニックネーム入力の自動入力抑止属性（共通） |
| `src/components/Auth/GuestEntryScreen.tsx` | `nicknameInputAntiAutofillProps` 適用・Hossiiキャラ吹き出しUI・`welcomeMessage` 表示 |
| `src/components/NicknameModal/NicknameModal.tsx` | 同上 |
| `src/components/Auth/OnboardingModal.tsx` | 同上（フォームに `autoComplete="off"`） |
| `src/components/ProfileScreen/ProfileScreen.tsx` | 同上 |
| `src/components/AccountScreen/AccountScreen.tsx` | 同上 |
| `src/core/types/space.ts` | `welcomeMessage?: string` を `Space` 型に追加 |
| `src/components/SpaceSettingsScreen/GeneralTab.tsx` | ウェルカムメッセージ入力欄を追加 |
| `src/core/utils/spacesApi.ts` | `welcome_message` カラムの読み書き対応 |
| Supabase `spaces` テーブル | `welcome_message text` カラムを追加（ダッシュボードで実行） |

---

## Supabase マイグレーション SQL

```sql
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS welcome_message text;
```
