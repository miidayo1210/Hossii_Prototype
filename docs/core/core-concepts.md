# Hossii Core 概念定義

> **バージョン:** 0.1
> **最終更新:** 2026-03-06
> **ステータス:** Draft

---

## このドキュメントの目的

Hossii全体で使用する用語と概念を定義する。
新しいスペースを設計するとき・実装するときに、共通言語として参照する。

---

## 1. Hossiiとは

「小さな入力が積み重なり、場に景色を生む」プラットフォーム。

単なる感情ログやコメントツールではなく：

- **Input（入力）** しやすく
- **Render（見える化）** して触って気持ちよく
- **Archive（蓄積）** して何かが手元に残り
- **Expand（展開）** して場が閉じない

という体験を中核とする。詳細は [space-product-vision.md](../space-product-vision.md) を参照。

---

## 2. 用語定義

### Community（コミュニティ）

Hossiiを利用する組織・チームの単位。管理者アカウントに紐づく。

- 1つのCommunityが複数のSpaceを持つ
- URLスラッグ（`/c/[community-id]`）を持つ
- 対応テーブル: `communities`

### Space（スペース）

特定の目的に特化した「体験パッケージ」。Hossiiが売るもの。

- Communityに紐づく
- 入力・可視化・蓄積・展開の構造を持つ
- Feature Flagプリセットで構成される
- URLスラッグ（`/s/[space-id]`）を持つ
- 対応テーブル: `spaces`

### Hossii（投稿）

参加者がSpaceに置くコンテンツの単位。「気持ち」や「つぶやき」。

- テキスト・感情タグ・画像・数値・音声ログを含みうる
- 手動（manual）と自動（auto）の2種類
- 対応テーブル: `hossiis`

> コード内の型名も `Hossii` 。`Post` や `Comment` とは呼ばない。

### Action（アクション）

参加者がSpaceに対して行う操作の総称。現時点では主にHossii投稿を指す。

- 将来的にはいいね・コメント・スタンプなども含む

### Emotion（感情タグ）

Hossiiに付けられる8種の感情ラベル。

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

### User（ユーザー）の3種類

| 種別 | 説明 | 識別方法 |
|------|------|---------|
| Admin（管理者） | Supabase Auth でログイン。Spaceを作成・管理する | `app_metadata.role = "admin"` |
| Member（ログイン参加者） | Supabase Auth でログイン。投稿・ログ閲覧ができる | `auth.users` に存在 |
| Guest（ゲスト参加者） | ニックネームのみで参加。端末固有IDで識別 | localStorage + `authorId` |

### Feature Flag

スペース単位で機能をON/OFFする仕組み。詳細は [feature-flags.md](../feature-flags.md) を参照。

- スペースはFeature Flagのプリセットとして設計される
- 管理画面のFeature FlagsタブからON/OFF可能

---

## 3. 4レイヤーモデル

すべてのSpaceは以下4レイヤーで構成される。

```
Input  →  Render  →  Archive  →  Expand
（入力）  （見える化）  （蓄積）    （展開）
```

### Input Layer（入力）

人が自然に入力できる形式：
- テキスト（コメント・気づき）
- 画像（現場・ポストイット・模造紙）
- 音声（内省・ブレスト）
- 気持ちタグ
- 数値（体温・歩数など）

> 設計思想：小さな入力が積み重なり、後から意味を持つ。

### Render Layer（見える化）

- バブル型・星型表示（現在のメインUI）
- ボード型表示（Miro的）
- 時系列表示
- スライドショー
- 空間投影（プロジェクター向け大画面）

> 設計思想：「整理」ではなく「体験化」。

### Archive Layer（蓄積・成果物）

- PDF ZINE出力
- 成長ログ可視化
- アクティビティ統計
- 変化の通知

> 設計思想：何かを"持ち帰れる"。

### Expand Layer（展開）

- SNS共有
- 外部公開レベル制御
- 他スペースとの連携（将来）

> 設計思想：スペースは閉じない。

---

## 4. 共通データ構造

### Hossii型（投稿）

```ts
type Hossii = {
  id: string;
  message: string;
  emotion?: EmotionKey;
  spaceId: string;
  authorId?: string;
  authorName?: string;
  createdAt: Date;
  origin?: 'manual' | 'auto';
  autoType?: 'emotion' | 'speech' | 'laughter';
  speechLevel?: 'word' | 'short' | 'long';
  imageUrl?: string;
  numberValue?: number;
};
```

### Space型

```ts
type Space = {
  id: string;
  spaceURL: string;           // パブリックURL用スラッグ
  name: string;
  cardType: 'constellation' | 'stamp' | 'graph';
  quickEmotions: EmotionKey[];
  background: SpaceBackground;
  createdAt: Date;
};
```

---

## 5. 画面（ルート）一覧

| Screen | URLハッシュ | 説明 | 種別 |
|--------|------------|------|------|
| StartScreen | `/` | 起動・ログイン | Core |
| GuestEntryScreen | `/s/[slug]` | ゲスト入室 | Core |
| PostScreen | `#post` | 投稿入力 | Core |
| SpaceScreen | `#screen` | スペースビュー | Core |
| CommentsScreen | `#comments` | ログ一覧 | Core |
| SpacesScreen | `#spaces` | スペース管理 | Core |
| SpaceSettingsScreen | `#settings` | スペース設定 | Core |
| ProfileScreen | `#profile` | プロフィール | Core |
| MyLogsScreen | `#mylogs` | マイログ | Core |
| AccountScreen | `#account` | アカウント情報 | Core |
| StampCardScreen | `#card` | スタンプカード | Core |
| SlideshowScreen | `#slideshow` | スライドショー | オプション |
| ReflectionScreen | `#reflection` | 内省スペース | オプション |

---

## 6. 用語の禁止事項

以下の用語はHossiiでは使用しない。

| 禁止語 | 代わりに使う語 |
|--------|--------------|
| Post | Hossii（投稿） |
| Tweet / Message | Hossii（投稿） |
| Room | Space（スペース） |
| Leapday | （固有名詞のため汎用語として使わない） |
| Demo / Core | src層の分類のみに使う（仕様書では使わない） |

---

## 7. 関連ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [space-product-vision.md](../space-product-vision.md) | スペースの商品思想・優先スペース定義 |
| [feature-flags.md](../feature-flags.md) | Feature Flag実装仕様 |
| [仕様書/現在の仕様/](../仕様書/現在の仕様/) | 機能別実装仕様（Core・Implementation） |
| [spaces/_space-template.md](../spaces/_space-template.md) | 新スペース仕様書テンプレート |
