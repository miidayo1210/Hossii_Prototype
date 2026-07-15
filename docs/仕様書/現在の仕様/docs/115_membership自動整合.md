# 115 membership 自動整合

> **ステータス:** 調査・仕様ドラフト（**未実装**）。本書確定後に migration / RPC / 導線修正を実装する。  
> **最終更新:** 2026-07-16  
> **想定 branch:** `feat/membership-auto-reconcile`（仮）  
> **上位仕様:** [109_コミュニティ所属個人アカウント・個人スペース・招待制スペース](../109_コミュニティ所属個人アカウント・個人スペース・招待制スペース.md)（§8 community_memberships / §13 space_memberships / §16 状態遷移）  
> **関連:** [110_アカウントマージ将来仕様](../110_アカウントマージ将来仕様.md)（自動 merge は対象外）

## 背景

Hossii では **コミュニティ所属**（`community_memberships`）と **スペース参加**（`space_memberships`）を別テーブルで管理する（109 §7）。

多くの機能（Community HOME、個人スペース `ensure_my_personal_space`、invite_only スペースの HOME 表示、`admin_add_space_member` の前提）は **active な community_membership** を要求する。

一方、public shared スペースへの自己参加 RPC `join_space_as_member` は **`space_memberships` のみ** を作成するため、ログインユーザーがスペースに入るだけで **community 未所属** の状態が発生しうる。

Production では既に欠損が確認されている（本書 §Production 調査）。恒久対応として、(1) 今後の欠損防止、(2) 既存欠損の安全な backfill が必要。

## 現在の問題

### 症状

- active な `space_memberships` があるのに、同一 `spaces.community_id` に対する `community_memberships` が無い
- ユーザーは public スペースに投稿・閲覧できても、Community HOME・マイスペース・招待制スペース管理が使えない
- 管理者画面の個人スペース所有者表示など、community 文脈の機能が欠損する

### 直接原因（コード上）

| 経路 | community 作成 | 欠損リスク |
|------|------------------|------------|
| `join_space_as_member`（自動参加含む） | **しない** | **高（主因）** |
| `issue-participant-account`（`linkSpaceMembership` のみ） | 任意（既定 OFF） | **高** |
| ログイン / 新規登録直後 | しない | 間接（直後の auto-join で顕在化） |
| `accept_community_invitation` | する | 逆方向（community のみ・space 無し） |
| `admin_add_space_member` | しない（**事前に active community 必須**） | 低 |
| `admin_add_community_member` | する | 逆方向（UI 未接続） |
| `ensure_my_personal_space` | しない（**事前に active community 必須**） | N/A |
| legacy nickname 移行 | しない | 高（membership backfill 無し） |

### 整合性の正本

| 関係 | 正本テーブル | 備考 |
|------|-------------|------|
| ユーザー ↔ コミュニティ | `community_memberships` | `UNIQUE (community_id, auth_user_id)` |
| ユーザー ↔ 共有スペース | `space_memberships` | `UNIQUE (space_id, auth_user_id)` |
| スペースの所属コミュニティ | `spaces.community_id` | `NULL` のスペースは本仕様の対象外 |

**権限の正本**は引き続き `communities.admin_id` / JWT `super_admin`（109 §8.2）。`community_memberships.role` は所属記録であり、自動整合で **admin を付与しない**。

## 自動作成条件（恒久ルール）

次を **すべて** 満たすとき、`community_memberships` を **不足分のみ** 作成する。

1. 対象ユーザーに、当該 `spaces.community_id` の **active** な `space_memberships` が存在する（またはこれから作成される）
2. `spaces.community_id IS NOT NULL`
3. 同一 `(auth_user_id, community_id)` の `community_memberships` 行が **存在しない**

### 作成する role / status

| 項目 | 値 |
|------|-----|
| `role` | `member`（固定） |
| `status` | `active` |
| `accepted_at` | `now()` |
| `invited_by` | 呼び出し文脈があれば設定（自己参加の場合は `NULL` 可） |

### 既存行がある場合の扱い

| 既存 `community_memberships.status` | 自動整合の動作 |
|-------------------------------------|----------------|
| **行が無い** | `member` / `active` を **INSERT** |
| `active` | **変更しない** |
| `admin`（active 想定） | **変更しない**（role を下げない） |
| `suspended` | **変更しない・復活させない** |
| `removed` | **変更しない・復活させない** |
| `invited` | **変更しない**（管理者招待フローを優先） |

> **原則:** space 参加だけで `suspended` / `removed` / `invited` を `active` に戻すのは **禁止**。109 §16.1 の管理者操作・再招待フローを尊重する。

### 対象外

- `spaces.community_id IS NULL`
- `space_memberships.status <> 'active'`（suspended / removed の space 参加から community を作らない）
- personal space の `owner_user_id` だけが存在し space_membership が無いケース（本仕様のトリガー条件外。別途 personal space 仕様）
- 別 `community_id` への波及
- account merge（110）

## 対象導線（実装時にフックする箇所）

### 必須（欠損防止の主経路）

| # | 経路 | 実装ポイント |
|---|------|-------------|
| 1 | public shared 自己参加 | `join_space_as_member` 内で整合 RPC を呼ぶ |
| 2 | フロント自動参加 | `membershipJoinController` → `joinSpaceAsMember`（RPC 側で足りるが、二重呼び出しは冪等に） |
| 3 | 参加 ID 発行 | `issue-participant-account` で `linkSpaceMembership=true` のとき |

### 任意（防御的・既にゲートあり）

| # | 経路 | 備考 |
|---|------|------|
| 4 | `admin_add_space_member` | 既に active community 必須。呼んでも no-op が多い |
| 5 | `admin_add_space_member` ON CONFLICT 再 active 化 | 既存 community 行があれば触らない |

### 対象外（本仕様では変更しない）

| 経路 | 理由 |
|------|------|
| `accept_community_invitation` | community のみ作成が正。space は別操作 |
| `admin_add_community_member` | 逆方向。space 自動追加は別仕様 |
| `ensure_my_personal_space` | 参加前提。作成元ではない |
| Auth ログイン / 登録 | membership 作成責務を持たない |
| legacy nickname 移行 | 別タスク（必要なら backfill で対応） |

## DB 側の保証方法（推奨実装）

### 推奨: **C（共通 RPC）+ D（選択的に導線フック）**

新規 SECURITY DEFINER 関数（仮名）:

```sql
ensure_community_membership_for_space_member(
  p_space_id text,
  p_auth_user_id uuid DEFAULT auth.uid()
) RETURNS void
```

**責務:**

1. `spaces` から `community_id` を取得（NULL なら return）
2. active な `space_memberships (p_space_id, p_auth_user_id)` を確認
3. `community_memberships` が **無いときだけ** INSERT（`ON CONFLICT DO NOTHING`）
4. 既存行があれば **一切 UPDATE しない**

**呼び出し元:**

- `join_space_as_member`（INSERT 成功後）
- `issue-participant-account` Edge Function（space membership upsert 後）
- （任意）`admin_add_space_member`（防御）

### 非推奨を主軸にしない理由

| 案 | 評価 |
|----|------|
| A. 導線ごとに個別 INSERT | 経路漏れリスク大。Edge Function と RPC の二重実装 |
| B. DB trigger のみ | INSERT は捕捉できるが、Edge Function / 将来経路の漏れ・テスト困難。`suspended` 誤復活を避ける条件が複雑 |
| C. 共通 RPC | **推奨**。条件を 1 箇所に集約。テスト可能 |
| D. C + 導線フック | **採用**。漏れにくく差分も小さい |

### オプション（ベルトアンドサスペンザー）

`space_memberships` **AFTER INSERT** trigger で同一 RPC を呼ぶ案は、C が全導線に入った後の追加防御として検討可。初版は **RPC + 既知導線フック** に留める（差分最小）。

## 一度限りの backfill

### カテゴリ A: 欠損（community 行が無い）

**対象:** active `space_memberships` + `spaces.community_id IS NOT NULL` + 対応 `community_memberships` **不存在**

**処理:**

```sql
INSERT INTO community_memberships (community_id, auth_user_id, role, status, accepted_at)
SELECT DISTINCT s.community_id, sm.auth_user_id, 'member', 'active', now()
FROM space_memberships sm
JOIN spaces s ON s.id = sm.space_id
WHERE sm.status = 'active'
  AND s.community_id IS NOT NULL
  AND NOT EXISTS (...)
ON CONFLICT (community_id, auth_user_id) DO NOTHING;
```

- 既存行は変更しない
- admin role を下げない（存在時は no-op）
- 重複作成しない

### カテゴリ B: 競合（community 行はあるが active でない）

**対象:** active `space_memberships` があるが `community_memberships.status IN ('suspended','removed','invited')`

**処理:** **自動では触らない**。管理者が `admin_reactivate_community_member` または再招待で対応。

Production 現状（2026-07-16 調査）では **カテゴリ B = 0 件**。

## RLS / 権限

- 一般 `authenticated` は `community_memberships` へ **直接 INSERT 不可**（109 / migration 既定）
- 整合は **SECURITY DEFINER RPC** または **service role Edge Function** からのみ
- RPC 内では `p_auth_user_id` を引数で任意指定できるため、**呼び出し元で本人性を検証**する
  - `join_space_as_member`: `p_auth_user_id = auth.uid()` 固定
  - Edge Function: 発行直後の participant `auth_user_id` のみ
- 整合 RPC は **role 昇格・status 変更を行わない**（INSERT のみ・ON CONFLICT DO NOTHING）

## エラー時の挙動

| 層 | 方針 |
|----|------|
| `join_space_as_member` | space membership 作成は成功を優先。整合 RPC 失敗時は **例外を握りつぶさずログ**し、space 参加は維持（現行 auto-join と同様、画面を壊さない） |
| フロント auto-join | 現行どおり失敗を `onError` ログのみ（`membershipJoinController`） |
| Edge Function | space / community link 失敗時は発行全体を失敗させる（現行と同様） |
| backfill migration | 1 行でも失敗したら migration 全体をロールバック（トランザクション内） |

## 既存データへの影響

- backfill は **不足行の追加のみ**
- 既存の `admin` / `suspended` / `removed` 行は不変
- Production 欠損 5 件（2 ユーザー × 4 コミュニティ文脈）はすべて `member` 追加想定
- public スペースの `can_access_space` 挙動は変更しない（非 member も public は閲覧可のまま）

## 受入条件

### 恒久整合

- [ ] public shared 自己参加後、対応 `community_memberships (member, active)` が存在する
- [ ] 既に active community member のユーザーで重複行ができない
- [ ] 既存 `admin` community membership の role が変わらない
- [ ] `suspended` / `removed` / `invited` の community 行が自動で `active` にならない
- [ ] 別 community に影響しない
- [ ] `issue-participant-account` で space link 時も同様に整合する

### backfill

- [ ] 欠損カテゴリ A のみ追加される
- [ ] カテゴリ B は変更されない
- [ ] Production 適用前に Development で件数・冪等性を検証

### 非回帰

- [ ] `admin_add_space_member` の「active community 必須」ゲートは維持
- [ ] `ensure_my_personal_space` の前提は維持
- [ ] 投稿所有権・スペース設定権限は変更しない

## Development / Production 適用手順

1. **Development**
   - migration 作成（整合 RPC + `join_space_as_member` 修正 + backfill SQL）
   - `npm run db:push:dev`
   - 手動: public スペース訪問 → community membership 自動作成
   - 手動: suspended ユーザーで auto-join → community status 不変
   - `npm test` / lint / build
2. **PR + Preview 確認**（Development DB）
3. **Production**
   - `npm run db:target -- production` でリンク確認
   - Dashboard でバックアップ時刻確認
   - `CONFIRM_PRODUCTION=wzyoddyvfjkagqpnjejo npm run db:push:prod`
   - read-only 集計で欠損 0 を確認
   - フロントは main merge → Vercel Production 自動デプロイ（Edge Function 変更時は別途 deploy）

---

## 付録 A: 導線別調査詳細（2026-07-16 / main `0829d69`）

| # | 導線 | space_memberships | community_memberships | role / status | 欠損可能性 |
|---|------|-------------------|----------------------|---------------|------------|
| 1 | 通常ログイン → public shared 訪問（auto-join） | **作成** `member`/`active` | **作成しない** | — | **高** |
| 2 | guest → ログイン / 登録 | 作成しない（直後 auto-join で 1 と同じ） | 作成しない | — | **高** |
| 3 | 管理者 参加 ID 発行 | 任意（`linkSpaceMembership`） | 任意（`linkCommunityMembership`） | `member`/`active` | **高**（既定は両方 OFF） |
| 4 | `issue-participant-account` | 同上 | 同上 | 同上 | **高** |
| 5 | `join_space_as_member` | **作成** | **作成しない** | `member`/`active` | **高** |
| 6 | `accept_community_invitation` | 作成しない | **作成** invite role / `active` | 逆欠損 | 中 |
| 7 | `admin_add_space_member` | **作成** / 再 active | 事前 active 必須 | `member`/`active` | 低 |
| 8 | legacy participant / nickname 移行 | **backfill 無し** | — | — | 高（別途） |
| 9 | `ensure_my_personal_space` | 作成しない | 前提のみ | — | N/A |
| 10 | `admin_add_community_member` | 作成しない | **作成** | 引数 role / `active` | 逆欠損（UI 無し） |

**INSERT / UPSERT の全経路（コードベース）:**

- RPC: `join_space_as_member`, `admin_add_space_member`, `admin_add_community_member`, `accept_community_invitation`
- Edge Function: `issue-participant-account`（`issue` action のみ）
- migration backfill: `20260713170000`（admin のみ）
- フロントからの直接 INSERT: **なし**（RLS で拒否）

## 付録 B: Production read-only 調査（2026-07-16）

**Project ref:** `wzyoddyvfjkagqpnjejo`  
**方法:** service role による集計のみ（PII 非表示・INSERT/UPDATE/DELETE 無し）

| 指標 | 件数 |
|------|------|
| active space_memberships（community 付き space） | 7 |
| **欠損 user/community ペア** | **5** |
| 欠損ユーザー数（distinct） | 2 |
| 欠損コミュニティ数（distinct） | 4 |
| 欠損 space_membership 行数 | 5 |
| 欠損の space_role 内訳 | member: 5 |
| status 競合（community 行はあるが active でない） | **0** |
| 同一 user/community で複数 space membership（欠損内） | 0（max 1 / ペア） |
| 参加者 ID 経由と推定される欠損ユーザー | 1 |
| 通常ログイン auto-join と推定される欠損ユーザー | 1 |
| 欠損 joined_at &lt; 2026-07-14 | 0 |
| 欠損 joined_at ≥ 2026-07-14 | 5 |

**解釈:** 欠損はすべて membership 機能本番反映後の新規データ。legacy より **現行 `join_space_as_member` 系の欠損** が主因と判断できる。

## 付録 C: 実装規模と最小タスク

**規模: 中**

| タスク | 内容 |
|--------|------|
| 1 | migration: `ensure_community_membership_for_space_member` RPC |
| 2 | migration: `join_space_as_member` から (1) を呼ぶ |
| 3 | Edge Function: `linkSpaceMembership` 時に (1) 相当を実行 |
| 4 | migration: 欠損 backfill（カテゴリ A のみ） |
| 5 | SQL / Vitest: RPC 冪等・suspended 非復活・admin 非降格 |
| 6 | Development 検証 → PR → Production `db:push:prod` |
