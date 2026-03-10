# スーパー管理者の管理画面仕様

## 概要

スーパー管理者（Hossii 運営）がログイン後にアクセスできる管理画面の仕様。  
通常の管理者（コミュニティ管理者）とは異なり、全コミュニティ・全スペースを横断的に管理できる。

---

## 画面構成

### ログイン後の遷移

`/admin/login` でログインすると、ロールに応じて自動遷移する。

| ロール | 遷移先 |
|---|---|
| スーパー管理者（`isSuperAdmin: true`） | `#communities`（全コミュニティ一覧） |
| 通常の管理者（`isAdmin: true`） | `#spaces`（自コミュニティのスペース一覧） |

---

## `#communities`（コミュニティ一覧画面）

### 機能

- 登録されている**全コミュニティ**を一覧表示する
- Supabase RLS により、`super_admin` ロール以外のユーザーには空配列が返る（他のユーザーには見えない）

### 表示項目（コミュニティカード）

| 項目 | 内容 |
|---|---|
| コミュニティ名 | `communities.name` |
| ステータスバッジ | `approved`（承認済み）/ `pending`（審査中）/ `rejected`（却下） |
| 登録日 | `communities.created_at` |
| コミュニティ ID | `communities.slug` |
| 「スペースを管理 →」ボタン | そのコミュニティの `#spaces` へ遷移 |

### コミュニティへのスペース管理遷移

「スペースを管理 →」をクリックすると：

1. `AdminNavigationContext` に `overrideCommunityId / Name / Slug` をセット（React State）
2. `#spaces` へ遷移
3. `#spaces` では `overrideCommunityId` を使ってそのコミュニティのスペースのみ取得・表示する

---

## `#spaces`（スペース一覧画面）

### スーパー管理者として `#spaces` を開く場合の挙動

| アクセス方法 | `communityId` | 表示されるスペース |
|---|---|---|
| `#communities` から「スペースを管理」経由 | `overrideCommunityId`（特定コミュニティ） | そのコミュニティのスペースのみ |
| URL直打ち・リロード | `undefined`（override がリセットされる） | **全スペースが表示されてしまう**（現時点のバグ） |

### 「戻る」ボタン

- `isSuperAdmin` かつ `overrideCommunityId` がセットされている場合にのみ表示される
- クリックで `overrideCommunityId` をクリアして `#communities` へ戻る

### スペース操作（作成・削除）の挙動

スーパー管理者がスペースを作成・削除しようとすると、**一瞬反映されるがリロードで元に戻る**。

**原因:**

1. スペース作成: `insertSpace(space, communityId)` の `communityId` が `overrideCommunityId`（正常）だが、リロードで `overrideCommunityId` がリセットされるため `fetchSpaces(undefined)` で全スペース取得に切り替わり、別コミュニティのスペースが混入してしまう
2. スペース削除: Supabase RLS の `DELETE` ポリシーがコミュニティ管理者本人にのみ許可されており、スーパー管理者の DELETE がブロックされている可能性がある（`spacesApi.ts` の "0 rows updated" ログ参照）

---

## 現在の問題点・対応状況

### 問題1: リロードで全スペースが表示される → **対応済み（sessionStorage）+ URL 対応を追加**

- `AdminNavigationContext` の state を `sessionStorage` に永続化済み（`hossii_adminNav` キー）
- タブを閉じない限りリロード後も `overrideCommunityId` が復元される
- さらに、URL（`#spaces/{communitySlug}`）にコミュニティ slug を含めることで、タブを閉じた後や別タブからのアクセスでも正しく復元できるよう対応

### 問題2: スーパー管理者がスペースの作成・削除を永続化できない

- 作成: ローカル state には反映されるが、リロードで消える（RLS 修正が必要）
- 削除: RLS によって DB への DELETE がブロックされている可能性がある

### 問題3: URL に階層情報が含まれない → **実装**

- `#spaces` だけではどのコミュニティのスペースを管理しているか URL から判別できない
- `#spaces/{communitySlug}` 形式の URL を導入することで解決

---

## 実装済みの対応

### sessionStorage 永続化（`AdminNavigationContext`）

- `hossii_adminNav` キーで `{ id, name, slug }` を sessionStorage に保存・復元
- `setOverrideCommunity` で書き込み、`clearOverrideCommunity` で削除
- `useState` の初期値が sessionStorage から読み込まれるためリロード後も状態が維持される

### スーパー管理者の直接アクセスガード（`SpacesScreen`）

- `isSuperAdmin && !overrideCommunityId` かつ URL に slug もない場合は `#communities` へリダイレクト
- URL に slug があれば `fetchCommunityBySlug` で API から復元して override を設定

---

## URL 設計（実装）

### URL 形式

```
#spaces/{communitySlug}   例: #spaces/my-community
```

### `useRouter` の変更

- `parseHash` が `#spaces/my-community` を `{ screen: 'spaces', screenParam: 'my-community' }` にパース
- `navigate('spaces', 'my-community')` で `#spaces/my-community` にセット

### データ復元フロー（リロード時）

```
#spaces/my-community でリロード
  ↓
useRouter が screenParam = 'my-community' を取得
  ↓
AdminNavigationContext が sessionStorage から overrideCommunityId を復元
  ├─ 復元できた → そのまま表示（API コールなし）
  └─ 復元できなかった → fetchCommunityBySlug('my-community') で API から復元
          ↓
     setOverrideCommunity で override をセット・sessionStorage を更新
          ↓
     fetchSpaces(communityId) で正しいスペースを表示
```

---

## RLS 対応（Supabase ダッシュボードで実行）

`spaces` テーブルへのスーパー管理者フルアクセスを許可するポリシーを追加する：

```sql
CREATE POLICY "super_admin_full_access_spaces"
ON spaces
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);
```

---

## 望ましい UX（スーパー管理者視点）

```
#communities（全コミュニティ一覧）
  ↓「スペースを管理」クリック
#spaces/my-community（特定コミュニティのスペース一覧）
  ↓ リロード → URL + sessionStorage から復元してそのまま表示
  ↓「新しいスペースを作成」→ DB に community_id 付きで保存・リロード後も保持
  ↓「スペースを削除」→ DB から削除・リロード後も反映
  ↓「戻る」クリック
#communities
```

### 要件整理

| 要件 | 優先度 | 対応状況 |
|---|---|---|
| リロード後も特定コミュニティのスペースのみ表示される | 高 | 対応済み（sessionStorage）+ URL 対応 |
| スペースの新規作成が永続化される | 高 | RLS 修正が必要（Supabase ダッシュボード） |
| スペースの削除が永続化される | 高 | RLS 修正が必要（Supabase ダッシュボード） |
| 階層的な URL 構造になる | 中 | 対応済み（`#spaces/{slug}`） |

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/components/CommunitiesScreen/CommunitiesScreen.tsx` | コミュニティ一覧画面 |
| `src/components/SpacesScreen/SpacesScreen.tsx` | スペース一覧画面 |
| `src/core/contexts/AdminNavigationContext.tsx` | スーパー管理者のコミュニティ override 管理 |
| `src/core/contexts/AuthContext.tsx` | `isSuperAdmin` フラグの解決ロジック |
| `src/core/utils/communitiesApi.ts` | `fetchAllCommunities()` など |
| `src/core/utils/spacesApi.ts` | `fetchSpaces()` / `insertSpace()` / `deleteSpaceFromDb()` |
| `src/core/hooks/useHossiiStore.tsx` | `communityId` を使ったスペース取得ロジック |
