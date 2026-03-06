> **分類:** `[Core]` 投稿へのリアクション機能（いいね）
> **関連:** [04_データ保存機能.md](./04_データ保存機能.md)（hossii_likes テーブル）、[feature-flags.md](../../feature-flags.md)

> 最終更新: 2026-03-06
> 関連ファイル:
> `supabase/migrations/20260306000000_add_likes.sql`
> `src/core/utils/likesApi.ts`
> `src/core/types/index.ts`（Hossii 型）
> `src/components/SpaceScreen/Tree.tsx`（Bubble コンポーネント）
> `src/components/CommentsScreen/CommentsScreen.tsx`
> `src/core/hooks/useFeatureFlags.ts`
> `src/core/utils/featureFlagsApi.ts`

---

## 概要

スペースに存在する投稿（Hossii）に対する **いいね機能** の実装。
管理者がスペース設定でON/OFFできる **任意機能**（Feature Flag 制御）。

---

## 設計方針

| 方針 | 内容 |
|---|---|
| Feature Flag 制御 | `likes_enabled` フラグが ON のスペースでのみいいねボタンを表示 |
| 楽観的更新 | UI は即時更新し、Supabase への反映は非同期で行う |
| 匿名ユーザー | 未対応（`user_id` が必要なため。ゲストはいいねできない） |
| 一人一票 | `(hossii_id, user_id)` の複合 PK で保証 |

---

## Feature Flag

| キー | 説明 | デフォルト |
|---|---|---|
| `likes_enabled` | 投稿へのいいね機能 | `false`（デフォルト無効） |

スペース設定画面の「Feature Flags」タブから、スペースごとに ON/OFF できる。

---

## データ構造

### hossii_likes テーブル

```sql
CREATE TABLE hossii_likes (
  hossii_id   text        NOT NULL REFERENCES hossiis(id) ON DELETE CASCADE,
  user_id     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hossii_id, user_id)
);
```

### hossiis テーブルへの追加カラム

```sql
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;
```

`like_count` は `hossii_likes` の INSERT/DELETE トリガーで自動更新するキャッシュカラム。

### Hossii 型への追加

```ts
type Hossii = {
  // ...既存フィールド...
  likeCount?: number;    // Supabase の like_count カラムから取得
  likedByMe?: boolean;   // クライアント側ローカル状態（Supabase には保存しない）
};
```

---

## API（`src/core/utils/likesApi.ts`）

| 関数 | 説明 |
|---|---|
| `toggleLike(hossiiId, userId)` | いいね済みなら DELETE、未いいねなら INSERT。戻り値は操作後のいいね状態（`boolean`） |
| `fetchLikedIds(userId, hossiiIds[])` | 指定ユーザーがいいねしている hossii_id の一覧を `Set<string>` で返す |

---

## UI 実装

### スペース画面（`Tree.tsx` / Bubble コンポーネント）

- `viewMode === 'full'` かつ `likesEnabled === true` のときのみいいねボタンを表示
- ボタン表示: `❤️ N`（いいね済み）/ `🤍`（未いいね）
- タップ時に楽観的更新（ローカル状態を即時変更 → 非同期で Supabase に反映）
- `onPointerDown` で `stopPropagation()` してバブルのドラッグと競合しないようにする

### コメント一覧（`CommentsScreen.tsx`）

- 各カードの末尾（時刻の横）にいいねボタンを表示
- `LikeButton` コンポーネントとして定義。`likedByMe` / `likeCount` のローカル状態を持つ

---

## SpaceScreen の統合処理

```
SpaceScreen マウント時
  │
  ├─ useFeatureFlags(spaceId) → flags.likes_enabled を取得
  │
  └─ flags.likes_enabled === true かつ currentUser が存在する場合
       │
       └─ fetchLikedIds(currentUser.uid, hossiiIds) → likedIds: Set<string> を取得
            │
            └─ Bubble に hossii.likedByMe = likedIds.has(hossii.id) を渡してレンダー

Bubble でいいねボタンタップ時
  │
  ├─ 楽観的更新（localLikedByMe / localLikeCount の状態更新）
  └─ handleLike(hossiiId) → toggleLike() → likedIds を更新
```

---

## 実装ステータス

| 機能 | 状態 |
|---|---|
| `likes_enabled` Feature Flag の追加 | ✅ 実装済み（`20260306000000_add_likes.sql`） |
| `hossii_likes` テーブルの作成 | ✅ 実装済み（マイグレーション済み） |
| `hossiis.like_count` カラムの追加 | ✅ 実装済み（トリガーで自動更新） |
| `likesApi.ts`（toggleLike / fetchLikedIds） | ✅ 実装済み |
| `Hossii` 型に `likeCount` / `likedByMe` 追加 | ✅ 実装済み |
| スペース画面（Bubble）のいいね UI | ✅ 実装済み（`likes_enabled` フラグ ON 時のみ表示） |
| コメント一覧のいいね UI | ✅ 実装済み |
| ゲストユーザーのいいね対応 | **未実装**（`user_id` が必要なため） |
| いいね通知（バッジ・プッシュ） | **未実装** |

---

## 今後の対応

- **コメント機能**: いいねと同様に Feature Flag 制御で実装予定。`hossii_comments` テーブルを新規作成する
- **ゲストいいね**: ゲストに一時的な識別子を付与してローカルに保存する方式を検討
- **リアルタイム同期**: Supabase Realtime で `like_count` の変化を他端末に伝える
