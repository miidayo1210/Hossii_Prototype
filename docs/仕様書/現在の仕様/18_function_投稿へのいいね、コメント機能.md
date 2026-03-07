> **分類:** `[Core]` 投稿へのリアクション機能（いいね）
> **関連:** [04_データ保存機能.md](./04_データ保存機能.md)（hossiis テーブル）、[09_スペース管理画面UI仕様書.md](./09_スペース管理画面UI仕様書.md)

> 最終更新: 2026-03-07（実装完了）
> 関連ファイル:
> `supabase/migrations/20260306000000_add_likes.sql`（既存：like_count カラム追加）
> `supabase/migrations/20260307000001_add_anonymous_like_rpc.sql`（新規：匿名 RPC）
> `supabase/migrations/20260307000002_add_feature_likes_to_space_settings.sql`（新規：space_settings に列追加）
> `src/core/types/settings.ts`（SpaceFeatures に likesEnabled 追加）
> `src/core/utils/spaceSettingsApi.ts`（feature_likes_enabled のマッピング）
> `src/core/utils/likesApi.ts`（incrementLike 関数）
> `src/core/utils/hossiisApi.ts`（like_count のマッピング）
> `src/core/types/index.ts`（Hossii 型の likeCount）
> `src/components/SpaceScreen/Tree.tsx`（Bubble のいいね UI）
> `src/components/SpaceSettingsScreen/GeneralTab.tsx`（機能 ON/OFF トグル）

---

## 概要

スペースに投稿された吹き出し（Hossii）に対する **いいね機能** の実装。
スペース管理の「機能のON/OFF」からオン・オフを切り替えられる任意機能。

---

## 設計方針

| 方針 | 内容 |
|---|---|
| 認証不要 | ログインの有無を問わず誰でもいいね可能 |
| 何回でも押せる | 1人が何回でもいいねを押せる（カウントが増え続ける） |
| 楽観的更新 | ボタンを押した瞬間にカウントを +1 表示し、Supabase への反映は非同期 |
| スペース設定で制御 | `SpaceFeatures.likesEnabled` が `true` のスペースでのみいいねボタンを表示 |
| シンプルなカウンター | `hossiis.like_count` カラムを直接インクリメントする方式（ユーザー追跡なし） |

---

## 旧設計との変更点

旧仕様（2026-03-06 時点）からの変更：

| 項目 | 旧 | 新 |
|---|---|---|
| 認証 | ログイン必須（`user_id` が必要） | 不要（匿名OK） |
| 制限 | 一人一票（`hossii_likes` テーブルの複合 PK で保証） | 何回でも可 |
| DB 操作 | `hossii_likes` に INSERT/DELETE → trigger で `like_count` 更新 | `increment_hossii_like` RPC で `like_count` を直接 +1 |
| 制御方法 | Feature Flag `likes_enabled`（FeatureFlags タブ） | SpaceSettings `likesEnabled`（機能のON/OFF セクション） |

> `hossii_likes` テーブルと `likes_enabled` Feature Flag は削除せず残す（ロールバック用）。  
> 実際のいいね処理は RPC 経由に切り替える。

---

## スペース設定（機能のON/OFF）

`GeneralTab.tsx` の「機能のON/OFF」セクションに「いいね機能」トグルを追加する。

| 項目 | 内容 |
|---|---|
| 設定キー | `SpaceFeatures.likesEnabled` |
| デフォルト | `true`（新規スペースはデフォルト ON） |
| 保存先 | `space_settings.feature_likes_enabled` カラム |

---

## データ構造

### hossiis テーブル（既存カラムを使用）

```sql
-- 既存（20260306000000_add_likes.sql で追加済み）
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;
```

### increment_hossii_like RPC（新規追加）

```sql
-- 20260307000001_add_anonymous_like_rpc.sql
CREATE OR REPLACE FUNCTION increment_hossii_like(p_hossii_id text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE hossiis
  SET like_count = like_count + 1
  WHERE id = p_hossii_id
  RETURNING like_count;
$$;
```

`SECURITY DEFINER` にすることで、未ログインの匿名ユーザー（`anon` ロール）でも実行可能。

### space_settings テーブル（新規カラム追加）

```sql
-- 20260307000002_add_feature_likes_to_space_settings.sql
ALTER TABLE space_settings
  ADD COLUMN IF NOT EXISTS feature_likes_enabled boolean NOT NULL DEFAULT true;
```

### 型定義

**`src/core/types/settings.ts`:**

```ts
export type SpaceFeatures = {
  commentPost: boolean;
  emotionPost: boolean;
  photoPost: boolean;
  numberPost: boolean;
  likesEnabled: boolean;  // 追加
};

export const DEFAULT_SPACE_FEATURES: SpaceFeatures = {
  commentPost: true,
  emotionPost: true,
  photoPost: true,
  numberPost: false,
  likesEnabled: true,  // 追加（デフォルト ON）
};
```

**`src/core/utils/hossiisApi.ts`:** `HossiiRow` に `like_count` を追加し、`rowToHossii` で `likeCount` にマッピング。

---

## API（`src/core/utils/likesApi.ts`）

| 関数 | 説明 |
|---|---|
| `incrementLike(hossiiId)` | `increment_hossii_like` RPC を呼び出し、更新後の `like_count` を返す |
| `toggleLike(hossiiId, userId)` | **旧 API（廃止予定）**。hossii_likes テーブルを使うトグル方式。残すが今後は使わない |
| `fetchLikedIds(userId, hossiiIds[])` | **旧 API（廃止予定）**。残すが今後は使わない |

---

## UI 実装

### スペース画面の吹き出し（`Tree.tsx` / Bubble コンポーネント）

- `viewMode === 'full'` かつ `likesEnabled === true` のときのみいいねボタンを表示
- **吹き出しの右下**に配置（`margin-left: auto; width: fit-content` で右寄せ）
- ボタン表示: `❤️ N`（N = 現在のいいね数。0 件のときは数字を非表示）
- タップ時の動作:
  1. ローカル状態を即時 +1（楽観的更新）
  2. `onLike(hossii.id)` を呼び出し → 親（SpaceScreen）が `incrementLike` を非同期実行
- `onPointerDown` で `stopPropagation()` してバブルのドラッグと競合しないようにする
- **トグル動作はしない**（押すたびにカウントが増える一方向の操作）

### スペース画面の統合処理（`SpaceScreen.tsx`）

```
SpaceScreen マウント時
  │
  └─ spaceSettings.features.likesEnabled を確認
       │
       └─ true のとき Bubble に likesEnabled={true} を渡してレンダー

Bubble でいいねボタンタップ時
  │
  ├─ 楽観的更新（localLikeCount + 1）
  └─ handleLike(hossiiId) → incrementLike(hossiiId) → Supabase RPC
```

- `handleLike` は `currentUser` の有無を確認しない（認証不要）
- `fetchLikedIds` / `likedIds` の管理は不要になるため削除

---

## 実装ステータス

| 機能 | 状態 |
|---|---|
| `hossiis.like_count` カラム | ✅ 実装済み（`20260306000000_add_likes.sql`） |
| `increment_hossii_like` RPC | ✅ 実装済み（`20260307000001_add_anonymous_like_rpc.sql`）※Supabase 適用要 |
| `space_settings.feature_likes_enabled` カラム | ✅ 実装済み（`20260307000002_add_feature_likes_to_space_settings.sql`）※Supabase 適用要 |
| `SpaceFeatures.likesEnabled` 型定義 | ✅ 実装済み（`src/core/types/settings.ts`） |
| `spaceSettingsApi.ts` のマッピング更新 | ✅ 実装済み |
| `hossiisApi.ts` の `like_count` マッピング | ✅ 実装済み |
| `likesApi.ts` に `incrementLike` 追加 | ✅ 実装済み |
| `SpaceScreen.handleLike` の認証チェック削除 | ✅ 実装済み |
| `GeneralTab.tsx` にいいね機能トグル追加 | ✅ 実装済み |
| `Bubble` のいいね UI をインクリメント専用・右下配置に変更 | ✅ 実装済み |

> **Supabase 適用待ち**: `20260307000001` / `20260307000002` の2ファイルを `supabase db push` または Supabase ダッシュボードで適用するまで、本番環境では RPC と `feature_likes_enabled` 列が存在しない状態。

---

## 今後の検討事項

- **リアルタイム同期**: Supabase Realtime で `like_count` の変化を他端末に伝える（現状は自端末のローカル更新のみ）
- **スパム対策**: 短時間に大量いいねを防ぐレート制限（現時点では不要）
- **コメント機能**: いいねと同様に `SpaceFeatures` で制御する形で実装予定
