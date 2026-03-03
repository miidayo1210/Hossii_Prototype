# Feature Flags

## 概要

Hossii の Feature Flag システムは、**スペース単位**で機能を ON/OFF できる仕組みです。

スペースの商品思想・レイヤー設計については [space-product-vision.md](./space-product-vision.md) を参照。

- A段階（現在）: スペース単位で override できる
- B段階（将来）: ユーザー・テナント単位の override に拡張可能な設計

---

## 現在実装されているフラグ（A段階）

| Key | デフォルト | 説明 |
|-----|-----------|------|
| `comments_thumbnail` | `true` | コメント一覧で画像サムネイルを表示する |

---

## Kill Switch

環境変数 `VITE_FEATURE_FLAGS_DISABLED=true` を設定すると、**全フラグが `false`** になります。

```bash
# .env.local に追加
VITE_FEATURE_FLAGS_DISABLED=true
```

Vercel の場合は Environment Variables に設定してください。

---

## DB 設計

### feature_flags テーブル（フラグ定義）

```sql
create table feature_flags (
  key             text        primary key,
  description     text        not null default '',
  default_enabled boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### space_feature_flags テーブル（スペース単位 override）

```sql
create table space_feature_flags (
  space_id        text        not null references spaces(id) on delete cascade,
  flag_key        text        not null references feature_flags(key) on delete cascade,
  enabled         boolean     not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text,   -- 設定した管理者の端末ID（監査用）
  updated_by      text,   -- 最後に変更した管理者の端末ID（監査用）
  primary key (space_id, flag_key)
);
```

---

## 取得ロジック

```
優先順位（A段階）:
  space_feature_flags.enabled > feature_flags.default_enabled

優先順位（B段階：下記 B段階設計 参照）:
  user_feature_flags > space_feature_flags > tenant_feature_flags > feature_flags.default_enabled
```

### getFeatureFlagsForSpace(spaceId)

`src/core/utils/featureFlagsApi.ts` に実装。

1. `feature_flags` テーブルからデフォルト値を全件取得
2. `space_feature_flags` テーブルからスペース固有の override を取得
3. デフォルト値に override をマージして返す

---

## React での使い方

### useFeatureFlags Hook

```tsx
import { useFeatureFlags } from '../../core/hooks/useFeatureFlags';

const MyComponent = ({ spaceId }: { spaceId: string }) => {
  const { flags, loading } = useFeatureFlags(spaceId);

  if (loading) return null;

  return (
    <div>
      {flags.comments_thumbnail && <ThumbnailView />}
    </div>
  );
};
```

### 新しいフラグを追加する手順

1. **DB**: `feature_flags` テーブルに `INSERT` する（または migration に追加）
2. **型定義**: `src/core/utils/featureFlagsApi.ts` の `FeatureFlagKey` に追加
3. **デフォルト値**: `buildDefaults()` と `buildAllFalse()` と `castToFeatureFlags()` に追加
4. **管理UI**: `src/components/SpaceSettingsScreen/FeatureFlagsTab.tsx` の `FLAG_LIST` に追加
5. **UI**: `useFeatureFlags` Hook を使って表示を分岐

---

## キャッシュ

現在は **インメモリキャッシュ（TTL 1分）** で実装しています。

- `src/core/hooks/useFeatureFlags.ts` 内の `cache` Map に保持
- スペースIDが変わるたびに再フェッチ（キャッシュ有効期間内はスキップ）
- フラグ変更後は `invalidateFeatureFlagsCache(spaceId)` でキャッシュをクリア

将来的に SWR や React Query を導入した場合は、`getFeatureFlagsForSpace` を直接 key にして置き換えることができます。

---

## B段階設計（将来の拡張）

### 追加するテーブル

#### tenant_feature_flags（テナント単位 override）

```sql
create table tenant_feature_flags (
  community_id    uuid        not null references communities(id) on delete cascade,
  flag_key        text        not null references feature_flags(key) on delete cascade,
  enabled         boolean     not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,   -- auth.users.id
  updated_by      uuid,
  primary key (community_id, flag_key)
);
```

#### user_feature_flags（ユーザー単位 override）

```sql
create table user_feature_flags (
  profile_id      text        not null references profiles(id) on delete cascade,
  flag_key        text        not null references feature_flags(key) on delete cascade,
  enabled         boolean     not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (profile_id, flag_key)
);
```

### B段階の優先順位

```
user_feature_flags        (最優先: ユーザー個人設定)
  ↓ なければ
space_feature_flags       (スペース単位設定 - 現在の A段階)
  ↓ なければ
tenant_feature_flags      (コミュニティ全体設定)
  ↓ なければ
feature_flags.default_enabled  (グローバルデフォルト)
```

### B段階実装時の変更点

`getFeatureFlagsForSpace` を以下のシグネチャに拡張することで対応できます：

```typescript
// B段階の関数シグネチャ（現在は spaceId のみ）
async function getFeatureFlagsForSpace(
  spaceId: string,
  options?: {
    communityId?: string;   // tenant override 適用
    profileId?: string;     // user override 適用
  }
): Promise<FeatureFlags>
```

現在の実装は `options` を受け取らないだけで、関数の構造は B段階への拡張を想定して設計されています。

---

## 管理 UI

スペース管理画面（`/settings`）→ **Feature Flags** タブから設定できます。

- admin ユーザーのみ表示・操作可能
- フラグを切り替えると即座に DB に保存され、キャッシュもクリアされる
- 失敗時はトーストでエラーを表示

---

## ロールバック

フラグを OFF にするだけでコードの変更なしにロールバックできます。

1. Supabase ダッシュボード → `space_feature_flags` テーブルで該当行を更新
2. または スペース管理画面の Feature Flags タブで OFF に切り替え
3. Kill Switch が必要な場合は `VITE_FEATURE_FLAGS_DISABLED=true` を Vercel 環境変数に設定してデプロイ
