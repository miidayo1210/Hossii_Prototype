# スペース内タブ機能仕様書

> **分類:** `[Core / Space / Navigation]`
> **機能名:** スペース内タブ
> **内部名称:** Space Pane
> **関連機能:** スペース、投稿、背景設定、投稿フォーム設定、コメント一覧、QRコード、スペースURL、管理者権限、Realtime
> **ステータス:** 仕様確定（実装前最終レビュー反映: 2026-06-27）
> **目的:** 1つのスペース内に、複数の投稿空間をタブ形式で作成・切り替えられるようにする
> **関連仕様書:** [03](./03_スペースURL機能.md) [04](./04_データ保存機能.md) [08](./08_スペース（HOME）の仕様書.md) [09](./09_スペース管理画面UI仕様書.md) [24](./24_スペース管理_各スペースの設定_背景設定.md) [44](./44_ログ一覧画面.md) [86](./86_投稿フォーム項目設定.md) [87](./87_スペース表示パフォーマンス最適化.md) [91](./91_スペース説明表示.md)

---

## 1. 概要

Hossiiの1つのスペース内に、複数の独立した投稿空間を作成できる機能を追加する。

利用者からは「タブ」として見えるが、コード・DB上では既存のUIタブや `Space` 型との混同を避けるため、`SpacePane` と呼ぶ。

基本構造は以下とする。

```text
Community
└─ Space
   ├─ SpacePane A
   │  ├─ 背景
   │  ├─ 装飾
   │  ├─ 投稿フォーム設定
   │  └─ 投稿
   ├─ SpacePane B
   │  ├─ 背景
   │  ├─ 装飾
   │  ├─ 投稿フォーム設定
   │  └─ 投稿
   └─ SpacePane C
      ├─ 背景
      ├─ 装飾
      ├─ 投稿フォーム設定
      └─ 投稿
```

スペース名、説明文、公開URL、コミュニティ、権限などは、これまでどおりスペース全体に属する。

SpacePaneは、そのスペース内に表示される背景・投稿・一部設定を切り替える単位とする。

---

## 2. 背景と目的

現在のHossiiでは、1つのスペースに対して、基本的に1つの背景と1つの投稿空間が存在する。

授業、ワークショップ、イベント、地域活動などでは、同じ参加URLの中で、次のように複数の場面やテーマを切り替えて使用したいケースがある。

```text
[ はじめに ]
[ 今日の問い ]
[ アイデア ]
[ まとめ ]
```

現在は、場面ごとに別スペースを作る必要があり、以下の問題がある。

* QRコードやURLが複数になる
* 参加者がスペース間を移動する必要がある
* スペース一覧が増える
* 同じ企画の投稿が複数スペースに分散する
* 管理者が背景・投稿設定を個別に管理しにくい
* 一連の体験として見せにくい

スペース内タブにより、1つのスペースURLを維持したまま、複数の投稿空間を切り替えられるようにする。

---

## 3. 基本方針

### 3.1 既存スペースとの後方互換性

既存スペースは、機能追加後も現在のURL、QRコード、投稿、背景、設定をそのまま利用できることを必須とする。

既存スペースには、DB migrationによりデフォルトのSpacePaneを1件作成する。

既存投稿については、初期移行時に `space_pane_id` を一括更新しない。

```text
space_pane_id = NULL の既存投稿
→ そのスペースのデフォルトPaneに属する投稿として扱う
```

新規投稿は、デフォルトPaneを含めて、必ず明示的な `space_pane_id` を保存する。

### 3.2 既存URLの維持

現在のスペースURLは変更しない。

```text
/c/{communitySlug}/s/{spaceSlug}
```

Pane指定がない場合は、デフォルトPaneを表示する。

```text
/c/{communitySlug}/s/{spaceSlug}?pane={paneSlug}#screen
```

既存QRコードには `pane` パラメータを付けず、常にデフォルトPaneへ到達させる。

### 3.3 段階導入

初期リリースでは、次の範囲に限定する。

* Paneの追加
* Paneの名称変更
* Paneの並び替え
* Paneの表示・非表示
* Paneの切り替え
* Paneごとの投稿
* Paneごとの背景・主要ビジュアル
* Paneごとの投稿フォーム設定
* Pane固有URL・QRコード

初期リリースでは、次の機能はPane単位に分けない。

* Feature Flags
* いいね設定
* 投稿編集権限
* 隣人スペース
* ボトル配信
* 表示件数
* 表示期間
* viewMode
* layoutMode
* presentationMode
* 管理者権限

---

## 4. 用語

| 用語        | 意味                           |
| --------- | ---------------------------- |
| Space     | 現在のHossiiのスペース。コミュニティに属する    |
| SpacePane | 1つのSpace内に作られる投稿空間           |
| タブ        | SpacePaneを利用者向けに表示する際の名称     |
| デフォルトPane | Pane指定がない場合に表示するPane         |
| アクティブPane | 現在画面上で選択されているPane            |
| Pane固有設定  | SpacePaneで上書きできる背景・投稿フォーム等   |
| Space共通設定 | すべてのPaneで共有するスペース名、権限等       |
| レガシー投稿    | `space_pane_id = NULL` の既存投稿 |

---

## 5. 利用者と権限

### 5.1 一般参加者

一般参加者は以下を行える。

* 表示中のPaneを確認する
* 表示可能なPaneを切り替える
* 現在のPaneに投稿する
* 現在のPaneの投稿を閲覧する
* Pane固有URLから直接アクセスする

一般参加者は以下を行えない。

* Paneの追加
* Pane名の変更
* Paneの並び替え
* Paneの表示・非表示
* Pane設定の編集
* 非表示Paneの閲覧（**Space画面・直接URL `?pane=` いずれも不可**。設定画面からのみ確認・再表示可能 — §27 確定）

### 5.2 管理者

初期実装では、既存のコミュニティ管理者 `isAdmin` をPane管理権限として流用する。

スペース固有の所有者や共同管理者は新設しない。

管理者は以下を行える。

* Paneの追加
* Pane名の変更
* Paneの並び替え
* Paneの非表示・再表示
* Pane固有設定の編集
* Pane固有URL・QRコードの取得
* 非表示Paneの設定確認（**設定画面からのみ**。Space画面・`?pane=hiddenSlug` 直リンクでは閲覧しない — §27 確定）

DB上のCRUD権限も、親Spaceが属するCommunityの管理者に限定する。

---

## 6. 表示仕様

### 6.1 タブバーの位置

タブバーは、スペースタイトルおよび説明文の下、投稿空間の上に表示する。

```text
地域まちづくり論0622
2026年6月22日に実施した授業のHossiiです

[ はじめに ] [ 今日の問い ] [ アイデア ] [ まとめ ] [ ＋ ]
────────────────────────────────
現在選択中のPaneの背景・投稿空間
```

実際の配置は、現在の `TopBar`、`SpaceDescriptionInline`、`SpaceScreen` のDOM構造を確認して決定する。

### 6.2 一般参加者への表示

```text
表示可能なPaneが1件
→ タブバーを表示しない

表示可能なPaneが2件以上
→ タブバーを表示する
```

これにより、既存スペースの表示を原則として変えない。

### 6.3 管理者への表示

```text
Paneが1件のみ
→ タブバーを表示する

Paneが2件以上
→ タブバーを表示する
```

管理者には、タブバーの右端にPane追加用の `＋` ボタンを表示する。

### 6.4 選択状態

アクティブPaneは、背景色、下線、影などで他のPaneと区別する。

横幅に収まらない場合は、横スクロール可能とする。

タブ名は原則として1行表示とし、極端に長い名称は省略表示する。

Pane名の最大文字数は **30 文字**（§27 確定）。UI では ellipsis 表示。

### 6.5 非表示Pane

一般参加者には `is_visible = false` のPaneを表示しない。

**確定:** 非表示 Pane は **設定画面にのみ**表示する。Space 画面・`?pane=` 直リンクでは **管理者も閲覧不可**（§27 #6、§30.16）。

タブバーの表示条件は §6.2（一般参加者）・§6.3（管理者）に従う。非表示 Pane の扱いとは別論点である。

---

## 7. Paneの管理操作

### 7.1 Paneの追加

管理者がタブバー右端の `＋` を押すと、Pane作成UIを開く。

最低限の入力項目はPane名とする。

新規Paneには以下を設定する。

```text
id          自動生成
space_id    現在のSpace
name        入力された名称
slug        自動生成
sort_order  現在の末尾
is_default  false
is_visible  true
```

新規Paneの背景・投稿設定は、Space共通設定を継承する。

DB上ではPane固有値を `NULL` とし、設定値をコピーしない。

### 7.2 Pane名の変更

管理者はPane名を変更できる。

スペース画面上では、名称のみを簡易変更できる。

**確定: 名称変更は `name` のみ。`slug` は自動変更しない**（既存 Pane URL・QR を壊さないため）。

### 7.2a slug の変更

| 操作 | 仕様 |
|------|------|
| 名称変更 | `slug` **不変** |
| slug 手動変更 | **設定画面のみ**。変更前に「既存 Pane URL・QR が無効になる」警告を表示 |
| 新規 Pane 作成時 | 名称から `[a-z0-9-]` で自動生成。失敗時 `pane-{短縮ID}` |

slug、公開状態、背景等の詳細設定は設定画面で変更する。

### 7.3 Paneの並び替え

管理者は設定画面でPaneの順序を変更できる。

順序は `sort_order` に保存する。

**確定:** 初期は **上下ボタン**（§27 #16）。ドラッグ&ドロップは後続。

### 7.4 Paneの非表示

Paneの物理削除は初期リリースでは実装しない。

削除相当の操作は、`is_visible = false` とする。

非表示にしても、以下は保持する。

* Paneレコード
* 投稿
* 背景設定
* 投稿フォーム設定
* slug
* QRコードの参照先情報

slugは非表示後も再利用しない。

### 7.5 デフォルトPaneの制約

デフォルトPaneには以下の制約を設ける。

* Spaceごとに必ず1件存在する
* 複数作成できない
* 非表示にできない
* 初期リリースでは変更・削除できない
* `sort_order` の変更は可能
* 名称変更は可能

DBでは、Spaceごとに `is_default = true` が1件だけ存在する部分ユニーク制約を設ける。

---

## 8. URL仕様

### 8.1 URL形式

Pane固有URLにはquery parameterを使用する。

```text
/c/{communitySlug}/s/{spaceSlug}?pane={paneSlug}#screen
```

レガシーURLも同様に対応する。

```text
/s/{spaceSlug}?pane={paneSlug}#screen
```

### 8.2 解決ルール

| URLの状態        | 表示するPane           |
| ------------- | ------------------ |
| `pane` 指定なし   | デフォルトPane          |
| 存在する表示中Pane   | 指定Pane             |
| 存在しないslug     | デフォルトPane          |
| 非表示Pane・一般参加者 | デフォルトPane          |
| 非表示Pane・管理者   | **設定画面のみ**（Space 画面・直 URL 不可 — §27 #6） |
| Pane取得失敗      | デフォルトPaneまたはエラー表示  |

不正な `pane` が指定された場合は、`history.replaceState` によりURLから `pane` を除去する。

### 8.3 タブ切り替えと履歴

利用者がタブを切り替えた場合は、`history.pushState` を利用してURLを更新する。

ブラウザの戻る・進む操作では、以前選択したPaneを復元する。

既存のhash routerは変更せず、画面種別は引き続き `#screen`、`#post`、`#comments`、`#settings` で管理する。

```text
pathname → Spaceを識別
search parameter → Paneを識別
hash → 画面を識別
```

---

## 9. QRコード・共有URL

### 9.1 Space全体のQRコード

現在のQRコードを維持する。

```text
/c/{communitySlug}/s/{spaceSlug}
```

このQRコードからはデフォルトPaneを表示する。

### 9.2 Pane固有QRコード

管理者は、各Paneの固有URLをQRコードとして取得できる。

```text
/c/{communitySlug}/s/{spaceSlug}?pane={paneSlug}
```

Pane固有QRコードは、以下の場所から取得できるようにする。

* スペース設定画面
* 公開・共有設定（Share タブ）

**確定:** Space 画面の QR パネルへの Pane 固有 QR 対応は **後続 Phase**（§27 #21）。Phase 8 では設定画面・共有画面のみ（`PaneManagementTab` / `PublicShareTab`）。

---

## 10. DB仕様

### 10.1 space_panes

```sql
CREATE TABLE space_panes (
  id                      text PRIMARY KEY,
  space_id                text NOT NULL
                            REFERENCES spaces(id)
                            ON DELETE CASCADE,

  name                    text NOT NULL,
  slug                    text NOT NULL,
  sort_order              integer NOT NULL DEFAULT 0,

  is_default              boolean NOT NULL DEFAULT false,
  is_visible              boolean NOT NULL DEFAULT true,

  background              jsonb,
  saved_background_images jsonb,
  decorations             jsonb,

  character_image_url     text,
  character_name          text,
  custom_emotions         jsonb,
  bubble_shape_png        text,

  settings                jsonb,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (space_id, slug)
);
```

### 10.2 制約・インデックス

```sql
CREATE UNIQUE INDEX space_panes_one_default_per_space
  ON space_panes (space_id)
  WHERE is_default = true;

CREATE INDEX space_panes_space_sort
  ON space_panes (space_id, sort_order);

-- sort_order 重複は許容。同一 sort_order は id 昇順でタイブレーク
```

```sql
ALTER TABLE space_panes
  ADD CONSTRAINT space_panes_default_must_be_visible
  CHECK (NOT is_default OR is_visible);

-- 名称・slug（§27 確定）
ALTER TABLE space_panes
  ADD CONSTRAINT space_panes_name_length
  CHECK (char_length(name) BETWEEN 1 AND 30);

ALTER TABLE space_panes
  ADD CONSTRAINT space_panes_slug_format
  CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- default Pane の override 列は常に NULL（§13.6）。spaces が正本
ALTER TABLE space_panes
  ADD CONSTRAINT space_panes_default_no_overrides
  CHECK (
    NOT is_default
    OR (
      background IS NULL
      AND saved_background_images IS NULL
      AND decorations IS NULL
      AND character_image_url IS NULL
      AND character_name IS NULL
      AND custom_emotions IS NULL
      AND bubble_shape_png IS NULL
      AND settings IS NULL
    )
  );
```

**default Pane の `is_default` 変更禁止（Phase 1 必須）:**

部分ユニーク index は「2 件以上」を防ぐが、「0 件」は防げない。以下で **常に 1 件**を保証する。

| 制約 | 内容 |
|------|------|
| `is_default` 変更 | 作成後 **`is_default` の UPDATE 禁止**（trigger: `OLD.is_default IS DISTINCT FROM NEW.is_default` → RAISE） |
| default Pane 非表示 | 既存 CHECK `NOT is_default OR is_visible` で **不可** |
| default Pane DELETE | **禁止**（trigger または DELETE policy なし + UI 非公開） |
| 追加 Pane → default 化 | **初期リリース不可**（将来 Phase 10+） |

**Pane 数上限 20 件（§27 確定 — ハード上限）:**

| 層 | 内容 |
|----|------|
| UI / API | 作成前に件数チェック |
| **DB** | `BEFORE INSERT ON space_panes` trigger で `COUNT(*) >= 20` → RAISE |

**slug 再利用禁止:** `UNIQUE (space_id, slug)` により、`is_visible=false` でも slug は占有されたまま。

**ID 生成:** 既存 Space と同様 `generateId()`（`src/core/utils`）を使用。text PK。

**migration ファイル名（案）:** `20260629000000_add_space_panes.sql`（既存 `20260628*` 系列に続く）

**updated_at:** 既存 migration に DB トリガー自動更新パターンは少ない。`updateSpacePaneInDb` 呼び出し時に **`updated_at = now()` をアプリ側で明示**する（`spacesApi.ts` / `spaceSettingsApi.ts` と同型）。

### 10.3 hossiisへの列追加

```sql
ALTER TABLE hossiis
  ADD COLUMN space_pane_id text
  REFERENCES space_panes(id)
  ON DELETE SET NULL;
```

```sql
CREATE INDEX hossiis_space_pane_created
  ON hossiis (space_id, space_pane_id, created_at DESC);
```

初期実装ではSpacePaneを物理削除しない。

`ON DELETE SET NULL` はDB上の安全策として設定する。

**space_id と space_pane_id の整合（Phase 1 確定）:**

`space_pane_id = NULL` のレガシー行は許可する。`space_pane_id IS NOT NULL` の場合のみ、Pane が **同一 `space_id` に所属**することを保証する。

| 方式 | 評価 | Phase 1 |
|------|------|---------|
| 複合外部キー `(space_id, space_pane_id) → space_panes(space_id, id)` | PostgreSQL は `space_pane_id = NULL` 行では FK チェックを **スキップ**するため、非 NULL 行のみ部分的に効く。スキーマ変更が大きい | **不採用** |
| **BEFORE INSERT/UPDATE trigger** | 非 NULL 時に `space_panes` 照合。NULL レガシーに影響なし | **必須** |
| **RLS `WITH CHECK`**（hossiis INSERT/UPDATE） | anon key 直書き込み（`20260223000000_initial_schema.sql` L130–137）に対する **DB 層防御** | **必須** |
| アプリ側検証のみ | public write 残存のため **最終案にしない** | 必須だが **単独不可** |

**推奨: trigger + RLS RESTRICTIVE + アプリ検証の 3 層**（§18.4.1 参照）。

```sql
-- トリガー関数（概念）— 最終防御。RLS 合成に依存しない
CREATE OR REPLACE FUNCTION assert_hossii_pane_space_match()
RETURNS trigger AS $$
BEGIN
  IF NEW.space_pane_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM space_panes p
      WHERE p.id = NEW.space_pane_id
        AND p.space_id = NEW.space_id
    ) THEN
      RAISE EXCEPTION 'space_pane_id does not belong to space_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**RLS:** PERMISSIVE policy を追加するだけでは **既存 public write と OR 合成されて無効化される**（§18.4.1）。RESTRICTIVE policy または policy 置換が必要。

#### 10.3a Phase 1 における `hossiisApi` の read / write 境界（確定）

Phase 1 では **新規投稿の DB payload を変えない**。Pane ID の明示保存は Phase 4。

| 方向 | Phase 1 | Phase 4 |
|------|---------|---------|
| DB row → `Hossii` | `space_pane_id` → `spacePaneId?` の **read mapping を追加** | 同左 |
| `Hossii` → insert row | **`spacePaneId` が undefined のとき `space_pane_id` キーを payload に含めない** | `activePaneId` を必ず付与 |
| fetch filter | **変更なし**（`space_id` のみ） | Pane 条件追加（Phase 2） |

```ts
// insertHossii 概念 — Phase 1
const row = { ...existingFields };
if (hossii.spacePaneId != null) {
  row.space_pane_id = hossii.spacePaneId; // Phase 1 では通常到達しない
}
// undefined を NULL に serialize しない（キー省略）
```

**回帰テスト:** Phase 1 デプロイ前後で `insertHossii` の request body が **バイト単位で同一**であることを確認する（read mapping 追加のみ）。

### 10.3a Space 削除時の cascade

| 操作 | 結果 |
|------|------|
| `spaces` DELETE | `space_panes` CASCADE（FK）、`hossiis` CASCADE（既存 FK `space_id`） |
| `space_panes` DELETE（将来） | `hossiis.space_pane_id` SET NULL（初期 UI では DELETE 不可） |
| `communities` DELETE | `spaces` の FK 次第。**現行は community 削除 UI なし** |

### 10.4 デフォルトPane migration

既存の各Spaceに対して、デフォルトPaneを1件作成する。

初期値は以下とする（§27 確定）。

```text
name        メイン
slug        main
sort_order  0
is_default  true
is_visible  true
```

既存投稿の `space_pane_id` は更新しない。

### 10.5 新規Space作成時と default Pane 存在保証

**現行フロー（Space 作成経路）:**

| 経路 | ファイル | 処理 |
|------|----------|------|
| 管理画面で新規作成 | `SpacesScreen.tsx` L206–213 | `generateId()` → `addSpace` |
| レガシー URL パラメータ | `App.tsx` L275–280 | 存在しない spaceId を `addSpace` |
| slug 直アクセス | `App.tsx` L184 | `addSpaceLocal` のみ（DB insert なし） |

いずれも **Pane 作成は未存在**（`addSpace` → `insertSpace` のみ、`HossiiStoreProvider.tsx` L1175–1187）。

#### 10.5.1 方式比較

| 案 | 内容 | 長所 | 短所 |
|----|------|------|------|
| **A** クライアント `ensureDefaultSpacePane` | 冪等 UPSERT。作成直後・Space 読込時・管理画面で不整合検出時に実行 | デモ（Supabase 未設定）対応可。既存 `generateId()` 流用 | 単独では作成失敗時に Pane 不在 Space が残る |
| **B** DB trigger | `spaces` INSERT 後に default Pane を自動 INSERT | **全 insert 経路を網羅**（クライアント経路に依存しない） | trigger 内 ID 生成はクライアント `generateId()` と形式が異なる可能性。デモ localStorage-only Space には効かない |
| **C** RPC | `create_space_with_default_pane` で原子作成 | 真のトランザクション | 新 API・全作成経路の差し替えが必要。初期差分が大きい |

#### 10.5.2 推奨（Phase 1 確定）: **A + B の併用**

**クライアント 1 回の呼び出しだけに依存しない。** 以下 3 層で default Pane を保証する。

| 層 | タイミング | 内容 |
|----|-----------|------|
| **Migration** | デプロイ時 | 既存全 `spaces` に default Pane を INSERT（§10.4） |
| **DB trigger（B）** | `spaces` INSERT 成功後 | `insert_default_space_pane()` で `name=メイン`, `slug=main`, `is_default=true` を **冪等**作成。trigger 失敗時は Space INSERT ごとロールバック |
| **クライアント heal（A）** | `ensureDefaultSpacePane(spaceId)` を **冪等**実行 | ① `addSpace` / `insertSpace` 成功直後 ② Space 読込時（`fetchSpaceByUrl` / `fetchSpaces` 後）③ 管理画面で pane 一覧が 0 件または default 不在を検出時 |

**RPC（C）:** Phase 1 では **採用しない**。将来、作成経路が RPC に統一された段階で trigger を残すか RPC に移行するかを再評価する。

**デモ（Supabase 未設定）:** DB 層は使えないため **A のみ**（`resolveDefaultPane` が synthetic pane を返すフォールバックは §19.2 に限定）。

**default Pane ID（trigger / heal 共通）:** 冪等性のため **`{space_id}-pane-default`** の deterministic ID を使用する（クライアント `generateId()` とは別経路だが、Space 内で一意であれば可。衝突時は heal が検出して修正）。

**Pane 不在 Space の検出:** `fetchSpacePanes(spaceId)` が 0 件、または `is_default=true` が 0 件 → `ensureDefaultSpacePane` を実行。失敗時は §19.2。

#### 10.5.3 `insert_default_space_pane` trigger と RLS 権限（Phase 1 調査結果）

**Space 作成経路と INSERT 権限:**

| 経路 | ファイル | DB INSERT | 実行ユーザー |
|------|----------|-----------|-------------|
| 管理画面 | `SpacesScreen.tsx` L213 | `insertSpace` | ログイン済み **community admin**（`spaces_insert_own`） |
| レガシー URL | `App.tsx` L275 | `insertSpace` | セッション依存。**anon も可**（下記） |
| slug 直アクセス | `App.tsx` L184 | なし（`addSpaceLocal`） | — |

**重要:** `20260223000000_initial_schema.sql` L129 の **`public insert spaces`**（`WITH CHECK (true)`）は **現行 migration でも DROP されていない**。`20260301000002` の `spaces_insert_own` と **PERMISSIVE OR 合成**されるため、**匿名・ゲストでも `spaces` INSERT が理論上可能**。

一方 `space_panes` INSERT は **community admin RLS のみ**（§18.2）。

**結論:** `insert_default_space_pane` は **`SECURITY DEFINER`** とする。

| 要件 | 内容 |
|------|------|
| 実行主体 | trigger 関数を `SECURITY DEFINER` で定義 |
| `search_path` | 固定（例: `SET search_path = public`） |
| 入力検証 | `NEW.id`（space_id）のみ使用。固定値で default pane INSERT |
| 冪等 | `ON CONFLICT (id) DO NOTHING` または存在チェック |
| 代替案 | RPC + policy 置換は Phase 1 では採用しない |

**`SECURITY INVOKER` のままでは:** anon が `spaces` INSERT 成功 → trigger 内 `space_panes` INSERT が RLS で拒否 → **Space 作成全体ロールバック**（§19.2 と整合）。

**アプリ層:** `addHossii` / `insertHossii` 前に pane ↔ space 照合（`HossiiStoreProvider.tsx` L1070–1146 付近）。Phase 4 以降。

---

## 11. 投稿の所属判定

### 11.1 論理上のPane ID

既存投稿では `space_pane_id` が `NULL` の場合がある。

そのため、投稿の論理的なPane IDは以下で解決する。

```ts
function effectivePaneId(
  hossii: { spacePaneId?: string | null },
  defaultPaneId: string,
): string {
  return hossii.spacePaneId ?? defaultPaneId;
}
```

### 11.2 クライアント側判定

```ts
function matchesPane(
  hossii: Hossii,
  context: {
    spaceId: string;
    activePaneId: string;
    defaultPaneId: string;
  },
): boolean {
  if (hossii.spaceId !== context.spaceId) return false;

  return (
    effectivePaneId(hossii, context.defaultPaneId) ===
    context.activePaneId
  );
}
```

### 11.3 DB取得条件

デフォルトPaneでは、レガシー投稿と明示的なデフォルトPane投稿の両方を取得する。

```text
space_id = currentSpaceId
AND (
  space_pane_id IS NULL
  OR space_pane_id = defaultPaneId
)
```

追加Paneでは、指定Paneの投稿だけを取得する。

```text
space_id = currentSpaceId
AND space_pane_id = activePaneId
```

追加Paneの取得条件に `space_pane_id IS NULL` を含めてはならない。

### 11.4 新規投稿

新規投稿は、デフォルトPaneを含め、常に現在の `activePaneId` を保存する。

```ts
newHossii.spacePaneId = activePaneId;
```

フォーム側から任意のPane IDを渡すのではなく、状態管理層で現在のPaneを付与する。

---

## 12. 投稿取得・キャッシュ

### 12.1 Query Key

現在のquery keyにPaneを含める。

```text
{spaceId}:pane:{paneId}:{displayPeriod}:v2
```

全Pane横断取得の場合は以下とする。

```text
{spaceId}:pane:*:{displayPeriod}:v2
```

型としては、文字列を直接組み立てず、専用関数を使用する。

```ts
type PaneQueryScope =
  | { kind: 'pane'; paneId: string }
  | { kind: 'all-panes' };
```

### 12.2 キャッシュ構造

```text
entitiesById
→ Space・Pane横断で共有してよい

orderedIdsByQueryKey
→ Pane単位で分離する
```

同じ投稿IDを複数のquery keyから参照することは許可する。

### 12.3 タブ切り替え（キャッシュと再取得 — Phase 2 確定）

Pane 切り替え時は **必ず以下の順序**で処理する。キャッシュ表示だけで fetch を省略してはならない。

```text
1. 対象 Pane の query key にキャッシュ済み orderedIds があれば即時表示
2. 並行して、その Pane の投稿を必ず再取得（useSpaceHossiiFetch）
3. 再取得完了後、orderedIds を最新結果で同期（stale requestId は破棄）
```

| 項目 | 仕様 |
|------|------|
| 即時表示 | UX のためキャッシュは使う |
| 再取得 | **省略不可**。Pane 再訪時も同様 |
| stale 混入 | 現行 `requestIdRef` + `AbortController`（`useSpaceHossiiFetch.ts`）を Pane deps 追加で維持 |
| 背景 | resolver 切替は即時。画像は新 URL を fetch（§30.2） |

以前の Pane のキャッシュは **破棄しない**（戻ったときの即時表示に使う）。

### 12.4 楽観的追加

投稿送信時の楽観的追加は、投稿が属するPaneのquery keyにだけ反映する。

既存のように、同一Spaceの全query keyへ追加してはならない。

### 12.5 Realtime

Realtimeチャンネルは、初期実装ではSpace単位のまま維持する（現行 `HossiiStoreProvider.tsx` L962–1017 と同じ）。

```text
hossiis_realtime:{activeSpaceId}
```

受信後、`space_id` と `matchesPane()` によりクライアント側で判定する。

#### 12.5.1 Realtime と active Pane（Phase 4 確定）

**原則:** 「非アクティブ Pane のイベントを完全無視」は **INSERT のみ**に適用する。UPDATE / DELETE は **更新前後の active 所属**で分岐する（§12.9）。

非アクティブ Pane へ **切り替えた際**の最新化は §12.3 の **必須再取得**で行う。非アクティブ中に Realtime で `entitiesById` を更新しない。

**現行 Realtime の既知制約（Pane 以前から存在）:** DELETE イベントは `space_id` を検証せず id のみで除去する。Pane 導入後も同パターンを維持するが、他 Space の DELETE が誤って届く理論的可能性は残る（現行仕様の踏襲）。

### 12.6 listQueryKey の競合（必須対応）

現行 `HossiiStoreProvider` は **単一の `listQueryKey`** を SpaceScreen・CommentsScreen・QuickLog で共有する。`syncFetchedHossiis` の `APPLY_FETCH_RESULT` が **最後に sync した queryKey で上書き**する（L564–567）。

Pane 導入後は次を **必須**とする。

| 対応 | 内容 |
|------|------|
| query key v2 | `{spaceId}:pane:{paneId\|*}:{displayPeriod}:v2`（`hossiiQueryKey.ts`） |
| 呼び出し側の明示 key | SpaceScreen / CommentsScreen / QuickLog は **各自の queryKey をローカル保持**し、`getHossiisForQueryKey(entities, myQueryKey)` で取得する |
| `getActiveSpaceHossiis()` | 後方互換用。Pane 対応後は **画面ごとに explicit key を渡す方式を正**とする |
| `listQueryKey` | Phase 2 で deprecated 化を検討。最低限、Pane 切替・画面遷移で誤った一覧が表示されないことをテストする |

**Phase 2 必須（準備）:** `insertHossiiIntoSpaceQueries`（L355–370）を **parseQueryKey ベース**に書き換える準備。Phase 4 で Pane 限定 INSERT を有効化。

### 12.7 Query Key の構造化（Phase 2 必須）

文字列 `startsWith(\`${spaceId}:\`)` だけで挿入対象を決定してはならない。将来の filter 追加で再び誤挿入が起きる。

| 方式 | 評価 | 採用 |
|------|------|------|
| **parse / build 共通関数** | key を構造化型に parse。一致判定は `spaceId` + `paneScope` + `period` + `version` | **✅ 採用** |
| metadata 別 Map | 柔軟だが store 変更が大きい | 不採用 |
| startsWith 継続 | 現行 L361–362。Pane 導入後は unsafe | **廃止** |

```ts
// hossiiQueryKey.ts（Phase 2 拡張案）
type PaneQueryScope =
  | { kind: 'pane'; paneId: string }
  | { kind: 'all-panes' };

type ParsedHossiiQueryKey = {
  spaceId: string;
  paneScope: PaneQueryScope;
  displayPeriod: DisplayPeriod;
  version: 'v1' | 'v2';
};

export function parseQueryKey(key: string): ParsedHossiiQueryKey | null;
export function buildQueryKeyV2(
  spaceId: string,
  paneScope: PaneQueryScope,
  displayPeriod: DisplayPeriod,
): HossiiQueryKey;

/** Phase 4: insertHossiiIntoSpaceQueries は parse 結果で paneId が一致する key のみ */
export function queryKeysMatchingHossii(
  entities: HossiiEntitiesSlice,
  hossii: Hossii,
  runtime: SpacePaneRuntime,
): HossiiQueryKey[];
```

Phase 1 では query key v1 のまま（挙動変更なし）。Phase 2 で v2 + parse 関数を導入する。

### 12.8 mergeFetchedHossiisWithPendingInserts

楽観投稿のマージ（L121–147）に **Pane 一致判定**を追加する（**Phase 4 有効化**）。`pendingOptimisticByIdRef` の backup 行は `matchesPane(b, paneContext)` が true の場合のみ extras に含める。

### 12.9 Realtime イベント別処理（Phase 4 — RuntimeBridge 必須）

**前提:** `SpacePaneRuntimeBridge`（§14.5）が存在すること。Phase 2 では Realtime は **従来動作**（Pane 判定なし）。

**更新前状態:** Supabase payload の old row に依存せず、**`entitiesById[id]` の更新前エンティティ**を `before` として使う。

```ts
function wasActive(before: Hossii, runtime: SpacePaneRuntime): boolean;
function isActive(after: Hossii, runtime: SpacePaneRuntime): boolean;
// defaultPaneId 未解決時は wasActive / isActive を呼ばない
```

#### INSERT

| 条件 | 処理 |
|------|------|
| `isActive(after)` | active query に追加 + `entitiesById` upsert |
| それ以外 | **無視** |

#### UPDATE

| before active | after active | 処理 |
|---------------|--------------|------|
| ✅ | ✅ | active query 内の entity 更新 |
| ✅ | ❌ | **active query から除去**（Pane 移動・非表示化等） |
| ❌ | ✅ | **active query へ追加** |
| ❌ | ❌ | **無視** |

**例:** active Pane A 表示中に `space_pane_id` が B へ更新 → before active / after inactive → **A から除去**。

**例:** `is_hidden: false → true` → before active / after inactive → **active query から除去**。

#### DELETE

投稿 ID を **`entitiesById` と全 `orderedIdsByQueryKey` から除去**（Pane 横断）。

非アクティブ Pane 専用 query key は Phase 4 初期では更新しない（再訪時 §12.3 再取得で整合）。

---

## 13. Pane設定の継承

### 13.1 基本ルール

Pane固有設定は、Space設定を上書きするnullableなoverrideとして扱う。

```ts
resolvedValue =
  paneValue ??
  spaceValue ??
  systemDefault;
```

Spaceの既存設定をPane作成時にコピーしない。

これにより、Pane側に値が設定されていない場合は、Space設定の変更が自動的に反映される。

### 13.2 Paneで上書き可能な設定

初期リリースでは以下をPane単位で上書き可能にする。

* background
* savedBackgroundImages
* decorations
* characterImageUrl
* characterName
* customEmotions
* bubbleShapePng
* postFields
* posting.positionMode

### 13.3 Space共通のまま維持する設定

以下は初期リリースではSpace共通とする。

* name
* description
* spaceURL
* isPrivate
* welcomeMessage
* presetTags
* quickEmotions
* likesEnabled
* bubbleEditPermission
* Feature Flags
* neighbors
* bottleFrequency
* displayLimit
* displayPeriod
* viewMode
* layoutMode
* presentationMode
* randomRecallEnabled

### 13.4 デフォルトPaneの保存先

デフォルトPaneの設定を編集した場合は、既存の `spaces` または `space_settings` に保存する。

追加Paneの設定は `space_panes` に保存する。

読取処理は、デフォルトPane・追加Paneのどちらでも同じresolverを通す。

```ts
resolvePaneBackground(activePane, activeSpace);
resolvePanePostFields(activePane, spaceSettings);
```

これにより、画面側でデフォルトPaneかどうかを個別に分岐させない。

### 13.5 settings JSON

`space_panes.settings` には、初期リリースでは **Pane override 対象のみ**を保存する。型は既存 `PostFieldSettings` / `PostingSettings` の部分型に揃える（`src/core/types/settings.ts`、`postFieldSettings.ts` の `mergePostFieldSettings` を流用）。

```ts
/** space_panes.settings の TS 型（新規） */
type SpacePaneSettingsOverride = {
  postFields?: Partial<PostFieldSettings>;  // 7項目の部分上書き
  posting?: { positionMode?: 'auto' | 'selector' };
};
```

```json
{
  "postFields": { "message": { "enabled": true, "required": false } },
  "posting": { "positionMode": "selector" }
}
```

- **正本:** 追加 Pane の override は `space_panes.settings`。デフォルト Pane の postFields / positionMode の正本は引き続き **`space_settings` テーブル**（`spaceSettingsApi.ts`）。
- **読取:** `resolvePanePostFields(pane, spaceSettings)` → `pane.settings?.postFields` があれば `mergePostFieldSettings` で space 正本にマージ。
- **保存:** デフォルト Pane 編集 → 既存 `upsertSpaceSettings`。追加 Pane 編集 → `space_panes.settings` のみ UPDATE。
- **`starMarkerType`:** 現行は localStorage のみ（DB 列なし）。初期リリースでは **Space 共通**のまま。Pane override 対象外。

### 13.6 デフォルト Pane のビジュアル設定と spaces テーブルの関係

デフォルト Pane レコード（`is_default=true`）の `background` 等の列は **常に NULL** とし、正本は既存 `spaces` 行のまま維持する。

| 操作 | 保存先 |
|------|--------|
| デフォルト Pane の背景・装飾・キャラ等 | `spaces`（既存 `updateSpace` / `updateSpaceInDb`） |
| 追加 Pane の override | `space_panes` の該当 nullable 列 |
| デフォルト Pane レコードの override 列 | **書き込まない**（resolver は `pane ?? space` で space を読む） |

これにより migration 後も `spaces.background` が唯一の正本であり、[82](./82_スペース情報キャッシュ再同期.md) の slug 再取得フローと整合する。

---

## 14. 状態管理

### 14.1 採用方式

Paneの状態は、URLと新規 `SpacePaneContext` を併用して管理する。

```text
URL (?pane=slug)
→ 共有・復元可能なPane slug

SpacePaneContext
→ panes、defaultPane、activePane、切り替え処理

SpacePaneRuntimeBridge（ref）
→ HossiiProvider 内 Realtime / addHossii が参照する activePaneId
```

既存の `HossiiProvider` には **Pane メタデータ state を持たせない**（`ExtendedHossiiState` の肥大化を避ける）。

### 14.2 Provider構造（現行コードとの整合）

**現行 `App.tsx` L604–616:**

```text
AuthProvider
└─ AdminNavigationProvider
   └─ DisplayPrefsProvider
      └─ HossiiProvider          ← activeSpaceId, entities, Realtime
         └─ AppContent
```

**Pane 導入後（推奨）:**

```text
AuthProvider
└─ AdminNavigationProvider
   └─ DisplayPrefsProvider
      └─ HossiiProvider
         └─ SpacePaneProvider    ← activeSpaceId を useHossiiStore から取得
            └─ AppContent
```

| 判断 | 理由 |
|------|------|
| `SpacePaneProvider` は `HossiiProvider` の**内側** | `useHossiiStore().activeSpaceId` が必要（`SpacePaneProvider` が外側だと circular import リスク） |
| `HossiiProvider` は `useSpacePane()` を呼ばない | 親が子 Context に依存できないため |
| `activePaneId` の Store 注入 | **ref ブリッジ**（下記 §14.5） |

`DisplayPrefsProvider` は Pane 非依存のため **変更なし**（`presentationMode` 等は引き続き端末 global）。

### 14.3 SpacePaneContextの責務

* 現在のSpaceに属するPane一覧の取得
* デフォルトPaneの解決
* URLの `pane` パラメータの解決
* activePaneIdの保持
* activePaneの取得
* Pane切り替え
* `pushState` によるURL更新
* `popstate` による戻る・進む対応
* 非表示・存在しないPaneからのフォールバック
* 管理者向けPane一覧の提供
* resolverに必要なPane情報の提供

### 14.4 Contextが保持する候補

```ts
type SpacePaneContextValue = {
  panes: SpacePane[];
  visiblePanes: SpacePane[];

  defaultPane: SpacePane | null;
  activePane: SpacePane | null;
  activePaneId: string | null;

  isLoading: boolean;
  error: Error | null;

  setActivePaneById: (paneId: string) => void;
  setActivePaneBySlug: (slug: string) => void;
  reloadPanes: () => Promise<void>;
};
```

管理画面の編集中Paneは、必要に応じて別のローカルstateとして管理する。

閲覧中の `activePane` と、設定画面で選択中の `editingPane` を同一概念にしない。

### 14.5 HossiiProvider への activePaneId 受け渡し（SpacePaneRuntimeBridge）

`HossiiStoreProvider` 内の **Realtime 購読**（L962–1017）と **`addHossii`**（L1070–1146）は Pane 文脈を必要とするが、`HossiiProvider` は `SpacePaneContext` の子ではない。

**最小差分の解決策:** ref ブリッジ（**UI 描画の状態源には使わない**）

#### 14.5.1 型と契約（確定）

```ts
/** HossiiProvider が create し Context で provide。SpacePaneProvider が write、Store が read */
type SpacePaneRuntime = {
  spaceId: string | null;
  activePaneId: string | null;
  defaultPaneId: string | null;
};
```

| ルール | 内容 |
|--------|------|
| UI 描画 | **`useSpacePane()` のみ**。ref は使わない |
| ref を read する処理 | Realtime INSERT/UPDATE/DELETE、`addHossii`、`mergeFetchedHossiisWithPendingInserts`（Pane 一致） |
| Space 切替時 | **先に無効化**: `spaceId` を新 Space に、`activePaneId` / `defaultPaneId` を `null` にしてから Pane 解決 |
| 整合チェック | read 側は **`runtime.spaceId === activeSpaceIdRef.current`** を確認。不一致なら Realtime 無視・投稿送信不可 |
| Pane 未解決 | `activePaneId === null` → **投稿を送信しない**（ボタン disabled + `addHossii` ガード） |
| default 未解決 | `defaultPaneId === null` → **NULL 投稿の所属判定（matchesPane / effectivePaneId）を行わない**。Realtime の legacy NULL 行もスキップ |
| テスト必須 | 高速 Space 切替、Pane 切替直後の投稿、Space A → B → A の Realtime 混入なし |

#### 14.5.2 ref 更新タイミング（React 構造）

| 方式 | 採用 | 理由 |
|------|------|------|
| render 中の代入 | **不採用** | Concurrent Rendering で tearing の可能性 |
| `useEffect` | 次善 | 1 フレーム遅延で Realtime が古い Pane を参照しうる |
| **`useLayoutEffect`** | **✅ 採用** | DOM commit 前に ref を同期。Realtime / addHossii と同一 tick で整合 |

```ts
// SpacePaneProvider 内
useLayoutEffect(() => {
  spacePaneRuntimeRef.current = {
    spaceId: activeSpaceId,
    activePaneId: activePane?.id ?? null,
    defaultPaneId: defaultPane?.id ?? null,
  };
}, [activeSpaceId, activePane?.id, defaultPane?.id]);

// Space 切替開始時（panes loading 等）— activePane 解決前
useLayoutEffect(() => {
  if (isLoading || !defaultPane) {
    spacePaneRuntimeRef.current = {
      spaceId: activeSpaceId,
      activePaneId: null,
      defaultPaneId: defaultPane?.id ?? null,
    };
  }
}, [activeSpaceId, isLoading, defaultPane]);
```

| 処理 | activePaneId の参照元 |
|------|----------------------|
| `addHossii` | `spacePaneRuntimeRef.current`（`spaceId` 一致 + `activePaneId` 必須） |
| Realtime INSERT/UPDATE | `matchesPane(row, ref.current)`（`defaultPaneId` 未解決時は NULL 行スキップ） |
| `useSpaceHossiiFetch` | **hook 引数**で `paneContext` を SpaceScreen から渡す（ref 不要） |
| PostScreen UI | `useSpacePane()` から直接取得 |

**代替案（不採用理由）:**

| 案 | 不採用理由 |
|----|-----------|
| SpacePaneProvider を Hossii 外側 | `activeSpaceId` 取得が後ろ倒しになり App 構造変更が大きい |
| activePaneId を Hossii state に追加 | §14.1 の方針（Store 肥大化）に反する |
| Realtime を SpacePaneProvider に移動 | Realtime は entity store と密結合。移動コスト大 |

### 14.6 shouldReindexOrderedIds の拡張

`hossiiEntitiesState.ts` L124–132 の `shouldReindexOrderedIds` に **`spacePaneId` 変更**を追加する。Pane 間移動 UPDATE 時に orderedIds を再構築する。

## 15. 投稿画面

投稿画面では、現在選択中のPaneに対して投稿する。

### 15.1 query parameter の維持

`useRouter`（`useRouter.ts` L41–43）は **`window.location.hash` のみ変更**する。pathname と search（`?pane=`）は **自動維持**される。

```text
/c/community/s/space?pane=ideas#screen
  → navigate('post')
/c/community/s/space?pane=ideas#post   ← search はそのまま
```

**追加対応不要:** hash 遷移のみの現行実装で要件を満たす。

**BottomNav / TopRightMenu** から `#post` へ遷移する際も同様。Pane 付き URL を手動で消さない限り維持される。

### 15.2 PostScreen の Pane 参照

PostScreen（`PostScreen.tsx`）は現行 `loadSpaceSettings(activeSpace.id)` を直接呼ぶ。Pane 対応後:

| 取得 | ソース |
|------|--------|
| activePaneId | `useSpacePane()` |
| postFields | `resolvePanePostFields(activePane, spaceSettings)` |
| positionMode | `resolvePanePositionMode(activePane, spaceSettings)` |
| quickEmotions / presetTags | **Space 共通**（`getActiveSpace()` のまま） |
| feature flags | `useFeatureFlags(activeSpaceId)`（Space 共通） |

### 15.3 投稿保存

投稿保存時は、`spacePaneRuntimeRef` または `useSpacePane().activePaneId` を **`addHossii` 内で付与**する。フォームから paneId を受け取らない（改ざん防止）。

Pane 解決前（`activePaneId === null` かつ panes loading）は投稿ボタンを disabled にする。

### 15.4 クイック投稿パネル

`SpaceScreen` 上の `PostScreen`（panelMode）も同一ルール。Pane 切替中はパネルを閉じるか、送信中は切替不可とする（§30.4）。

---

## 16. コメント・ログ一覧

### 16.1 初期表示

`#comments` は、初期状態では現在選択中のPaneの投稿を表示する。

### 16.2 Paneフィルター

コメント一覧に以下のPaneフィルターを追加する。

```text
[ このタブ ] [ すべてのタブ ] [ 各タブを選択 ]
```

既存の以下のフィルターとは別に配置する。

```text
[ 全体のログ ] [ 私のログ ]
```

想定レイアウト：

```text
[ 全体のログ | 私のログ ]
[ このタブ | すべてのタブ | ▼各タブ ]
```

### 16.3 全Pane取得

「すべてのタブ」では、`space_id` のみで取得し、Pane条件を付けない。

query keyは `pane:*` を使用する。

### 16.4 初期リリース範囲（確定）

| 項目 | Phase |
|------|-------|
| 現在選択中 Pane の投稿のみ表示 | 本体（Phase 9 前半） |
| 「すべてのタブ」フィルタ | **Phase 9 後半（延期可）** |

最低限、現在の Pane だけを表示する対応は本体リリースに含める。

---

## 17. 設定画面

### 17.1 Pane管理

設定画面に、Paneの管理UIを追加する。

候補は以下の2方式とする。

```text
案A：新しい「タブ管理」設定項目を追加
案B：設定画面全体の上部にPane selectorを追加
```

推奨構造は併用方式とする。

* 「タブ管理」
  Pane追加、名称、slug、順序、表示状態、QRを管理する
* 設定画面上部のPane selector
  背景や投稿フォーム設定の編集対象を切り替える

### 17.2 編集対象

設定画面では、以下を明確に表示する。

```text
スペース全体を編集
現在のPaneを編集
```

Space共通設定の画面ではPane selectorを表示しない、または無効状態にする。

Pane固有設定の画面では、選択中Paneを表示する。

### 17.3 デフォルトPane

デフォルトPaneの背景・投稿フォームを編集した場合は、従来のSpace設定を更新する。

追加Paneでは `space_panes` のoverrideを更新する。

追加Paneの設定を「Space設定に戻す」操作を用意し、対象値を `NULL` に戻せるようにする。

---

## 18. RLS・セキュリティ

**原則:** 非表示 Pane（`is_visible = false`）の `name` / `slug` / `settings` 等は、**API 層の filter だけに依存せず、DB の SELECT ポリシーで一般利用者から隠す**。Supabase anon key からの直接 SELECT でも同様。

### 18.1 SELECT（space_panes — Phase 1 必須）

RLS を有効化し、**2 条件の OR** で SELECT を許可する。

| 利用者 | DB ポリシー条件 |
|--------|----------------|
| **一般利用者**（anon / 認証問わず） | `is_visible = true` |
| **親 Space の Community 管理者** | `spaces.community_id → communities.admin_id = auth.uid()` |

```sql
ALTER TABLE space_panes ENABLE ROW LEVEL SECURITY;

-- 一般: 表示 Pane のみ
-- 管理者: 同一 Community の Space に属する Pane は is_visible 無関係に全件
CREATE POLICY "space_panes_select_visible_or_admin"
  ON space_panes
  FOR SELECT
  USING (
    is_visible = true
    OR EXISTS (
      SELECT 1 FROM spaces s
      JOIN communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );
```

**スーパー管理者:** 必要なら [20260306000001](./../../../supabase/migrations/20260306000001_add_super_admin_rls.sql) パターンで `app_metadata.role = 'super_admin'` を OR 追加（Phase 1 調査）。

#### 18.1.1 API 関数の分離要否

| 方式 | 評価 |
|------|------|
| **単一 `fetchSpacePanes(spaceId)`** | **✅ 推奨**。RLS が正本のため、管理者ログイン時は自動的に非表示 Pane も返る。一般セッションでは返らない |
| 一般用 / 管理用で API 分離 | **不要**（セキュリティ上）。ドキュメント目的で `fetchSpacePanesForDisplay` 等の **エイリアス名**は可 |

**禁止:** 管理者向けに `.select('*')` で RLS をバイパスする service role を **ブラウザから使わない**。

**アプリ層:** 一般 UI 用に `.eq('is_visible', true)` を **追加 filter してもよい**（defense in depth）が、**RLS なしではデプロイ不可**。

### 18.2 INSERT・UPDATE

Paneの作成・更新は、親Spaceが属するCommunityの管理者だけに許可する。

判定は以下の関係を使用する（既存 `spaces_update_own` と同型）:

```sql
EXISTS (
  SELECT 1 FROM spaces s
  JOIN communities c ON c.id = s.community_id
  WHERE s.id = space_panes.space_id
    AND c.admin_id = auth.uid()
)
```

スーパー管理者は [20260306000001](./../../../supabase/migrations/20260306000001_add_super_admin_rls.sql) パターンを **必要なら** 追従（Phase 1 調査）。

### 18.3 DELETE

初期リリースではPane DELETE APIを公開しない。

DBポリシーでも DELETE を **管理者に限定しつつ UI から呼ばない**、または DELETE ポリシー自体を作らない。

### 18.4 投稿（hossiis — space / pane 整合）

現状の `hossiis` には demo 由来の **public write ポリシー**が残存（`20260223000000_initial_schema.sql` L127–137）。Pane機能とは別課題として記録。

Pane追加により既存の投稿権限モデルは変更しない。

**3 層防御（§10.3 確定）:**

| 層 | 内容 |
|----|------|
| アプリ | `addHossii` / `insertHossii` 前に pane ↔ space 照合（Phase 4） |
| **DB trigger** | `assert_hossii_pane_space_match`（BEFORE INSERT/UPDATE）— **RLS 合成に依存しない最終防御** |
| **RLS RESTRICTIVE** | 下記 §18.4.1 |

public write が残る限り、**アプリ検証のみを最終案にしない**。

#### 18.4.1 hossiis RLS と既存 public write の合成（Phase 1 確定）

PostgreSQL の PERMISSIVE policy は **OR 合成**される。次のように並べるだけでは **Pane 整合 policy が無効化される**:

```text
既存 PERMISSIVE: public insert hossiis  → WITH CHECK (true)  → 常に許可
新規 PERMISSIVE: pane match only       → 整合時のみ許可
→ OR 合成の結果、public policy だけで INSERT 可能（整合チェックが効かない）
```

**採用（Phase 1 確定）: 案 B — RESTRICTIVE policy を追加**

RESTRICTIVE policy は **AND 合成**。PERMISSIVE が許可しても、RESTRICTIVE が false なら拒否される。

```sql
CREATE POLICY "hossii_pane_space_match_restrict"
  ON hossiis
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    space_pane_id IS NULL
    OR EXISTS (
      SELECT 1 FROM space_panes p
      WHERE p.id = space_pane_id
        AND p.space_id = hossiis.space_id
    )
  );

CREATE POLICY "hossii_pane_space_match_restrict_update"
  ON hossiis
  AS RESTRICTIVE
  FOR UPDATE
  WITH CHECK (
    space_pane_id IS NULL
    OR EXISTS (
      SELECT 1 FROM space_panes p
      WHERE p.id = space_pane_id
        AND p.space_id = hossiis.space_id
    )
  );
```

| 案 | 内容 | Phase 1 |
|----|------|---------|
| **B RESTRICTIVE 追加** | 既存 public write を残しつつ Pane 整合を **AND で強制** | **✅ 採用** |
| A 既存 policy 置換 | `public insert/update hossiis` を DROP し admin-only 等に | 本番 RLS 整理時（別タスク） |

**trigger との関係:** RESTRICTIVE と trigger は **二重防御**。どちらか一方が欠けても不整合 INSERT は拒否される。

### 18.5 修正版 SQL 参考（migration 未作成）

```sql
-- ファイル名案: 20260629000000_add_space_panes.sql

CREATE TABLE space_panes (
  id                      text PRIMARY KEY,
  space_id                text NOT NULL
                            REFERENCES spaces(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  slug                    text NOT NULL,
  sort_order              integer NOT NULL DEFAULT 0,
  is_default              boolean NOT NULL DEFAULT false,
  is_visible              boolean NOT NULL DEFAULT true,
  background              jsonb,
  saved_background_images jsonb,
  decorations             jsonb,
  character_image_url     text,
  character_name          text,
  custom_emotions         jsonb,
  bubble_shape_png        text,
  settings                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug),
  CONSTRAINT space_panes_default_must_be_visible
    CHECK (NOT is_default OR is_visible)
);

CREATE UNIQUE INDEX space_panes_one_default_per_space
  ON space_panes (space_id) WHERE is_default = true;

CREATE INDEX space_panes_space_sort
  ON space_panes (space_id, sort_order);

ALTER TABLE hossiis
  ADD COLUMN IF NOT EXISTS space_pane_id text
  REFERENCES space_panes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hossiis_space_pane_created
  ON hossiis (space_id, space_pane_id, created_at DESC);

-- 既存 spaces へ default pane INSERT（name=メイン, slug=main, id={space_id}-pane-default）
-- RLS: space_panes_select_visible_or_admin + insert/update admin policies
-- Trigger: insert_default_space_pane AFTER INSERT ON spaces（SECURITY DEFINER — §10.5.3）
-- Trigger: assert_hossii_pane_space_match BEFORE INSERT/UPDATE ON hossiis
-- Trigger: space_panes immutability / max 20 / default is_default lock
-- hossiis RESTRICTIVE policies（§18.4.1）
-- CHECK: name length, slug format, default_no_overrides（§10.2）
```

---

## 19. エラー・フォールバック

### 19.1 Pane一覧の取得失敗

Pane取得に失敗した場合でも、既存Space画面を完全に利用不能にしない。

候補：

```text
- 一時的にSpaceをデフォルトPaneとして表示する
- 再読み込みボタンを表示する
- 投稿を一時的に無効化する
```

【確定】DB migration + trigger + heal 完了後、default Pane 不在時は **投稿を許可しない**（§14.5.1）。取得失敗時は再読み込み案内。

### 19.2 デフォルトPaneが存在しない

新規Space作成途中の失敗や不正データにより、デフォルトPaneが存在しない場合は以下とする。

管理者：

```text
設定不整合の警告を表示
デフォルトPane再作成操作を提供
```

一般参加者：

```text
Spaceを従来表示としてフォールバック
または再読み込み案内を表示
```

### 19.3 activePaneの非表示化

利用者が表示中のPaneを管理者が非表示にした場合、次回Pane一覧更新または画面再読み込み時にデフォルトPaneへ移動する。

RealtimeでPane設定変更を購読するかは初期実装では必須としない。

---

## 20. パフォーマンス

* Pane一覧はSpace単位で取得する
* Pane切り替え時にSpace全体を再取得しない
* 投稿キャッシュはPaneごとに分離する
* entitiesByIdは共有する
* Paneの背景画像は必要に応じて遅延読み込みする
* タブ切り替え時に、以前のPaneのDOM・アニメーションを残さない
* RealtimeチャンネルはPaneごとに張り直さず、Space単位を維持する
* 非表示Paneの投稿をSpaceScreenで取得しない
* Pane切り替え前のfetch結果が切り替え後に混入しないよう、request IDまたはAbortControllerを維持する

---

## 21. アクセシビリティ・操作性

タブバーは視覚上だけでなく、キーボードやスクリーンリーダーでも操作可能にする。

候補となるARIA構造：

```text
role="tablist"
role="tab"
aria-selected
aria-controls
```

ただし、URL遷移を伴うナビゲーションとして実装する場合は、通常のリンクとして扱う案も検討する。

スマートフォンでは以下を満たす。

* タップ領域を十分確保する
* 横スクロールを可能にする
* `＋` ボタンが他のタブに埋もれない
* 現在位置が分かる
* タブ切り替え後に画面が不自然にスクロールしない

---

## 22. イベント・分析ログ

**確定: 初期リリース対象外。** Hossii 内部に操作ログ・分析基盤がないため、§22 のイベントは実装しない。

将来基盤追加時の候補:

```text
space_pane_viewed / space_pane_created / space_pane_renamed / ...
```

---

## 23. 段階的実装計画

### Phase 一覧

| Phase | 変更ファイル（概算） | 新規ファイル（概算） | DB変更 | リスク | 先行条件 |
|-------|---------------------|---------------------|--------|--------|----------|
| **0** 仕様固定 | 0 | 0 | なし | 低 | — |
| **1** DB・型・API | 6–8 | 3–4 | `space_panes`, migration, trigger, RLS, `hossiis.space_pane_id` | 低 | Phase 0。**UI/filter 変更なし** |
| **2** 投稿取得・キャッシュ | 8–12 | 2 | index | **中**（listQueryKey） | Phase 1 |
| **3** SpacePaneContext・URL | 3–5 | 3–4 | なし | 中 | Phase 1 |
| **4** 投稿保存・Realtime | 4–6 | 0 | なし | 中 | Phase 2, 3 |
| **5** タブバー・背景切替 | 5–8 | 2–3 | なし | 中 | Phase 3, 4 |
| **6** Pane管理 UI | 4–6 | 2 | なし | 低 | Phase 3 |
| **7** 設定 override | 8–12 | 1–2 | なし | 中 | Phase 5, 6 |
| **8** URL・QR | 4–5 | 0 | なし | 低 | Phase 3 |
| **9** コメント Pane フィルタ | 3–4 | 1 | なし | 低 | Phase 2, 3 |
| **10** 任意整理 | 2–4 | 0 | backfill 任意 | 高 | 全 Phase |

**初期リリース（受入 §26）に必要な Phase:** 0–8 および 9 の「現在 Pane のみ」部分。Phase 9 の「すべてのタブ」は **初期リリースから外して可**。

### 初期リリースから外してよい項目

| 項目 | 延期先 | 理由 |
|------|--------|------|
| コメント「すべてのタブ」フィルタ | Phase 9 | 現 Pane のみで本体価値は成立 |
| `#mylogs` Pane フィルタ | Phase 10+ | 横断画面。初期スコープ外 |
| Pane 設定の Realtime 反映 | Phase 10 | 再読み込み・設定画面復帰で代替 |
| `archived_at` | Phase 10 | `is_visible` で十分 |
| 分析イベント §22 | — | 分析基盤なし |
| ドラッグ&ドロップ並び替え | Phase 6 以降 | 上下ボタンで可 |
| レガシー NULL backfill | Phase 10 | 方式 B で不要 |

### 初期リリース中核（維持）

Pane切替 / 投稿分離 / 背景 override / postFields override / Pane URL / Pane QR / 管理者 CRUD・非表示 / 既存互換

---

### Phase 0：仕様固定・既存挙動の確認

* 既存Space表示
* 既存投稿取得
* 投稿作成
* Realtime
* URL・QR
* 設定保存
* CommentsScreen
* Space作成

上記のsmoke testを整理する。

### Phase 1：DB・型・API（境界 — 実装前最終確定）

**Phase 1 では UI・Pane 切替・投稿 filter を有効化しない。** 既存画面の投稿取得条件は **`space_id` 単位の従来動作を維持**する（`hossiisApi.fetchHossiisPage` の filter 変更は Phase 2）。

#### Phase 1 対象

| カテゴリ | 内容 |
|----------|------|
| DB | `space_panes` テーブル、既存 Space への default Pane migration、`hossiis.space_pane_id` 列、index、constraint |
| DB | RLS（§18.1 SELECT、`space_panes` INSERT/UPDATE admin、`hossiis` pane/space WITH CHECK） |
| DB | trigger: `insert_default_space_pane`（spaces INSERT 後）、`assert_hossii_pane_space_match` |
| 型 | `SpacePane` 型、`Hossii.spacePaneId?` |
| API | `spacePanesApi.ts`（fetch / ensureDefault / CRUD 骨格） |
| Store | `ensureDefaultSpacePane` を Space 読込・作成後に呼ぶ（**挙動は DB heal のみ、UI 変更なし**） |
| 確認 | 既存 SpaceScreen / CommentsScreen / PostScreen が従来どおり動作 |

#### Phase 1 対象外（Phase 2 以降）

* `SpacePaneProvider` / タブバー / `?pane=` URL 解決
* query key v2、`useSpaceHossiiFetch` の pane filter
* `SpacePaneRuntimeBridge`
* PostScreen / addHossii への `space_pane_id` 付与
* Realtime の Pane 判定

#### Phase 1 変更予定ファイル

| 種別 | ファイル |
|------|----------|
| **新規** | `supabase/migrations/20260629000000_add_space_panes.sql` |
| **新規** | `src/core/types/spacePane.ts`（または `space.ts` へ co-locate） |
| **新規** | `src/core/utils/spacePanesApi.ts` |
| **新規** | `src/core/utils/ensureDefaultSpacePane.ts` |
| **変更** | `src/core/types/index.ts` — `Hossii.spacePaneId?` |
| **変更** | `src/core/utils/hossiisApi.ts` — **read mapping のみ**（§10.3a）。insert payload は Phase 1 で **変更しない** |
| **変更** | `src/core/hooks/HossiiStoreProvider.tsx` — `addSpace` 後 `ensureDefaultSpacePane`、Space fetch 後 heal |
| **変更** | `src/core/utils/spacesApi.ts` — fetch 後 heal フック（任意） |
| **変更（軽微）** | `src/components/SpacesScreen/SpacesScreen.tsx` — 作成成功 toast のみ可。UI 変更なし |

**変更しない（Phase 1）:** `SpaceScreen.tsx`, `useSpaceHossiiFetch.ts`, `hossiiQueryKey.ts`, `App.tsx` Provider ツリー, `PostScreen.tsx`

#### Phase 1 migration 内容（概要）

1. `CREATE TABLE space_panes`（§18.5）
2. `ALTER TABLE hossiis ADD COLUMN space_pane_id`
3. 既存全 `spaces` に `INSERT` default pane（`id = {space_id}-pane-default`, `name=メイン`, `slug=main`）
4. `ENABLE ROW LEVEL SECURITY` + policies（§18.1, §18.2, §18.4.1）
5. `insert_default_space_pane` trigger on `spaces`（**SECURITY DEFINER** — §10.5.3）
6. `assert_hossii_pane_space_match` trigger（§10.3）
7. default Pane 制約 trigger（`is_default` 変更禁止等 — §10.2）
8. Pane 数上限 trigger（20 件 — §10.2）
9. CHECK constraints（name / slug / default_no_overrides — §10.2）
10. index（§10.2）

#### Phase 1 テスト項目

| # | テスト |
|---|--------|
| 1 | migration 後、全既存 Space に `is_default=true` が 1 件 |
| 2 | 新規 Space 作成（SpacesScreen）→ default pane が DB に存在 |
| 3 | `insertSpace` 成功 + trigger 失敗シミュレーション → Space INSERT がロールバック |
| 4 | heal: pane 0 件 Space に `ensureDefaultSpacePane` → default 作成 |
| 5 | anon SELECT: `is_visible=false` pane が **返らない** |
| 6 | 管理者 auth SELECT: 非表示 pane が **返る** |
| 7 | `hossiis` INSERT with 他 Space の `space_pane_id` → **DB 拒否**（trigger または RLS） |
| 8 | `hossiis` INSERT with `space_pane_id=NULL` → **許可**（既存互換） |
| 9 | SpaceScreen 表示・投稿・Comments 一覧が **Phase 1 前と同一**（回帰） |
| 10 | Realtime 投稿が **従来どおり全件表示**（pane filter / RuntimeBridge 未導入） |
| 11 | Phase 1 前後で `insertHossii` payload に `space_pane_id` **キーが含まれない** |
| 12 | `insert_default_space_pane` が **SECURITY DEFINER** で anon spaces INSERT 後も default pane 作成 |
| 13 | default Pane の `is_default=false` UPDATE → **拒否** |
| 14 | 同一 Space 21 件目 Pane INSERT → **拒否** |

#### Phase 1 ロールバック

| 手順 | 内容 |
|------|------|
| アプリ | Phase 1 ブランチを revert。`ensureDefaultSpacePane` 呼び出し削除 |
| DB | 逆 migration: `DROP TRIGGER`, `DROP POLICY`, `ALTER TABLE hossiis DROP COLUMN space_pane_id`, `DROP TABLE space_panes` |
| データ | `hossiis.space_pane_id` は Phase 1 では **書き込まない**ため、列削除でデータ損失なし |
| 運用 | ロールバック後も既存 `space_id` 単位表示は維持 |

---

### Phase 2：投稿取得とキャッシュ対応

**Realtime / 楽観追加 / RuntimeBridge は Phase 2 では触らない**（Phase 4 へ）。

* Pane membership utility（`matchesPane` / `effectivePaneId`）
* default Pane の NULL 投稿 fetch 条件
* 追加 Pane の厳密 fetch 条件
* query key v2 + `parseQueryKey` / `buildQueryKeyV2`（§12.7）
* `orderedIdsByQueryKey` の Pane 分離
* 明示 query key 取得（SpaceScreen / CommentsScreen）
* ページング filter 更新（`hossiisApi.fetchHossiisPage`）
* `insertHossiiIntoSpaceQueries` の **parse ベース書き換え（挙動は Phase 4 まで従来同等でも可）**
* Realtime: **従来動作のまま**（Pane 判定なし）

### Phase 3：SpacePaneContextとURL

* Pane一覧取得
* default Pane解決
* `?pane=` 解決
* activePane管理
* pushState
* popstate
* 不正slugのフォールバック
* 非表示Paneのフォールバック

### Phase 4：投稿保存・Realtime Pane 対応

* `SpacePaneRuntimeBridge` 接続（§14.5）
* PostScreen / `addHossii` への `space_pane_id` 明示保存
* hash 切り替え時も query parameter 維持（§15.1）
* Pane 未解決時の送信防止
* 楽観的追加の Pane 限定（`insertHossiiIntoSpaceQueries` + §12.8）
* Realtime INSERT / UPDATE / DELETE の Pane 対応（§12.9）
* `mergeFetchedHossiisWithPendingInserts` の Pane 一致

### Phase 5：タブバー

* SpacePaneBar作成
* 一般参加者の表示条件
* 管理者の表示条件
* 切り替えUI
* `＋` ボタン
* 背景切り替え
* Paneごとの投稿表示

### Phase 6：Pane管理 — ✅ 実装済み（2026-06-27）

* Pane追加
* 名称変更
* 並び替え
* 表示・非表示
* default Pane制約
* 管理者権限
* 非表示Paneの管理画面表示

### Phase 7：Pane設定override — ✅ 実装済み（2026-06-27）

* 背景 / 保存済み背景（`resolvePaneBackground` / `resolvePaneSavedBackgroundImages`）
* 装飾（`resolvePaneDecorations`）
* キャラクター / customEmotions（`resolvePaneCharacter`）
* bubbleShape（`resolvePaneBubbleShapePng`）
* postFields（`resolvePanePostFields`）
* positionMode（`resolvePanePositionMode`）
* 設定画面 Pane セレクタ（`settingsEditPaneId` — URL `activePane` と独立）
* Space 設定への復帰（override 列 / settings JSON を `null`）
* デフォルト Pane → `spaces` / `space_settings`、追加 Pane → `space_panes`
* Runtime: `PostScreen` / `SpaceScreen`（`resolvePaneVisualSpace`）

関連: `savePaneSettingOverride.ts`, `SettingsPaneSelector.tsx`, `SettingsEditPaneContext.tsx`, `PANE_OVERRIDE_SCREENS`

### Phase 8：URL・QR・共有 — ✅ 実装済み（2026-06-27）

* Pane 固有 URL 生成（`buildPaneShareUrl` / `buildShareUrlForPane` — `spaceShareUrl.ts`）
* URL コピー（`PaneShareBlock`）
* Pane 固有 QR（`PaneManagementTab` — QR ダイアログ、`PublicShareTab` — タブごと QR セクション）
* 既存 Space QR 互換（`buildSpaceShareUrl` — pane なし、`QRCodePanel` リファクタ）
* 非表示 Pane: URL/QR は設定画面で disabled 表示

関連: `PaneShareBlock.tsx`, `PaneShareDialog.tsx`, `spaceShareUrl.ts`

### Phase 9：コメント一覧

* 現在のPane
* すべてのPane
* 指定Pane
* query key `pane:*`
* PaneFilterSegment

### Phase 10：任意のデータ整理

* レガシー投稿のbackfill
* `space_pane_id IS NULL` 互換処理の廃止検討
* Pane設定の構造見直し
* 監査ログ
* archived_at
* 投稿のPane移動

---

## 24. テスト要件

### 24.1 既存互換

* 既存URLからSpaceへアクセスできる
* 既存QRコードが使用できる
* 既存投稿がデフォルトPaneに表示される
* 既存背景が表示される
* 既存投稿フォームが動作する
* Paneが1件の一般参加者画面は従来とほぼ同じ
* Space設定がこれまでどおり保存される

### 24.2 Pane表示

* 管理者にはPaneが1件でもタブバーが表示される
* 一般参加者にはPaneが1件なら表示されない
* Paneが2件以上なら一般参加者にも表示される
* 非表示Paneは一般参加者に表示されない
* Pane順序が `sort_order` に従う

### 24.3 投稿分離

* デフォルトPaneにはNULL投稿とdefaultPaneId投稿が表示される
* 追加PaneにはNULL投稿が表示されない
* Pane Aの投稿がPane Bに表示されない
* Realtime投稿が異なるPaneに混入しない
* 楽観的投稿が異なるPaneに混入しない
* ページング結果が異なるPaneに混入しない
* Pane切り替え中の古いfetch結果が混入しない

### 24.4 URL

* `pane` なしでデフォルトPane
* 有効slugで指定Pane
* 不正slugでデフォルトPane
* 非表示slugで一般参加者はデフォルトPane
* **非表示slugで管理者もデフォルトPane**（`?pane=` 直リンク閲覧不可 — §27 #6）。設定画面から再表示
* リロードでPaneを維持
* 戻る・進むでPaneを復元
* `#screen`、`#post`、`#comments` 間でPaneを維持

### 24.5 管理

* 一般参加者はPaneを作成できない
* 管理者はPaneを作成できる
* 名称変更できる
* 並び替えできる
* 非表示・再表示できる
* default Paneを非表示にできない
* slugの重複を作成できない
* 非表示Paneのslugを再利用できない

### 24.6 設定

* Pane固有値がない場合はSpace設定を継承する
* Pane固有背景がある場合は上書きされる
* Pane固有値をNULLに戻すとSpace設定へ戻る
* デフォルトPane編集は既存テーブルへ保存される
* 追加Pane編集は `space_panes` へ保存される

### 24.7 Phase 1（DB 基盤のみ）

* migration 後、全 Space に default pane が 1 件
* 新規 Space 作成で trigger により default pane 自動作成
* `ensureDefaultSpacePane` が pane 不在 Space を heal
* anon SELECT で `is_visible=false` pane が取得できない
* 管理者 SELECT で非表示 pane が取得できる
* 他 Space の `space_pane_id` 付き hossii INSERT が DB で拒否される
* `space_pane_id=NULL` の hossii INSERT が許可される
* SpaceScreen / Comments / PostScreen の **表示・投稿が Phase 1 前と同一**

---

## 25. ロールバック方針

各Phaseは単独で切り戻せるようにする。

UI機能を無効化した場合でも、既存SpaceはPaneを意識せずデフォルトPaneとして表示できるようにする。

初期段階では以下を維持する。

* `space_pane_id` はnullable
* 既存投稿は更新しない
* 既存Space設定は移動しない
* 既存URLは変更しない
* 既存QRは変更しない
* SpacePaneを物理削除しない

緊急時には、Pane UIとPane filterを無効化し、従来どおり `space_id` 単位で表示できる余地を残す。

ただし、追加Paneに作成された投稿を従来表示へ戻す場合、全Paneの投稿が同時表示されるため、運用上の注意が必要となる。

---

## 26. 初期リリースの受入条件

以下を満たした時点で初期リリース可能とする。

1. 既存Spaceの表示・投稿・QRが壊れていない
2. 管理者が2件目のPaneを作成できる
3. タブバーからPaneを切り替えられる
4. Paneごとに投稿が完全に分離される
5. Paneごとに背景を変更できる
6. Paneごとに投稿フォームを変更できる
7. Pane固有URLから直接アクセスできる
8. Pane固有QRを生成できる
9. 非表示Paneを一般参加者が閲覧できない
10. Realtime・ページング・楽観的追加で投稿が混入しない
11. ブラウザの戻る・進むでPaneが復元される
12. 管理者以外がPaneを変更できない

---

## 27. 確定事項（実装前最終 — 2026-06-27）

以下は **確定済み**。実装時に【要確認】として再議論しない。

| # | 項目 | 決定 |
|---|------|------|
| 1 | デフォルト Pane 名 | **メイン** |
| 2 | デフォルト Pane slug | **main** |
| 3 | Pane slug 規則 | `[a-z0-9-]`。名称から自動生成、失敗時 `pane-{短縮ID}` |
| 4 | Pane 名上限 | **30 文字** |
| 5 | Pane 数上限 | **20 件** |
| 6 | 非表示 Pane | Space 画面に出さない。**管理者も `?pane=` 直リンクでは閲覧不可**。設定画面のみ |
| 7 | タグフィルター | **初期は Space 単位**（`hossii.spaceTagFilter.{spaceId}`） |
| 8 | モデレーション | **初期は Space 横断**。Pane 列・filter は後続 Phase |
| 9 | Comments「すべてのタブ」 | **Phase 9 延期可** |
| 10 | Pane メタ Realtime | **初期対象外** |
| 11 | 物理削除 | **対象外**（`is_visible` のみ） |
| 12 | default Pane 存在保証 | **Migration + DB trigger + クライアント heal**（§10.5.2） |
| 13 | hossiis / pane 整合 | **trigger + RLS WITH CHECK + アプリ**（§10.3） |
| 14 | 非表示 Pane RLS | **DB SELECT ポリシー必須**（§18.1） |
| 15 | 設定画面構造 | 「タブ管理」+ Pane 固有設定画面上部 selector |
| 16 | 並び替え UI | 初期は上下ボタン |
| 17 | hossiis RLS 合成 | **RESTRICTIVE policy**（§18.4.1）。PERMISSIVE 追加のみは不可 |
| 18 | default trigger 権限 | **`SECURITY DEFINER`**（§10.5.3） |
| 19 | slug 変更 | 名称変更では **不変**。手動変更のみ + 警告 |
| 20 | Pane 数上限 | **DB ハード上限 20**（trigger） |
| 21 | Pane 固有 QR（Space 画面） | **後続 Phase**（§9.2） |
| 22 | 分析イベント | **初期対象外**（§22） |

### 実装調査後でもよい（Phase 1 以降）

| # | 項目 |
|---|------|
| 17 | スーパー管理者 RLS の `space_panes` 追従 |
| 18 | `settings jsonb` の厳密 TS 型の最終形 |
| 19 | レガシー NULL backfill 時期（Phase 10） |
| 20 | RPC `create_space_with_default_pane` 導入時期 |

---

## 28. 設計上の推奨（確定事項の根拠）

§27 の決定根拠を簡潔に記録する。

```text
デフォルトPane名 / slug     → メイン / main（既存 QR・URL 互換、短い slug）
Pane slug                   → [a-z0-9-]、URL 安全
Pane名上限 / 数上限         → 30文字 / 20件（タブバー UX・性能）
非表示Pane                  → RLS + URL フォールバックで漏洩防止。管理者も閲覧は設定画面のみ
コメント一覧                → 現在Pane必須、全Paneは Phase 9
状態管理                    → URL + SpacePaneContext + SpacePaneRuntimeBridge（ref）
デフォルト方式              → default Pane レコード + 既存投稿 NULL 維持
新規投稿                    → default 含め space_pane_id 明示保存（Phase 4）
default 存在保証            → A+B（trigger + heal）。クライアント 1 回依存禁止
hossiis 整合                → trigger + RESTRICTIVE RLS（§18.4.1）。PERMISSIVE 追加のみ不可
default trigger             → SECURITY DEFINER（§10.5.3）。public insert spaces 残存を考慮
Realtime UPDATE             → before/after active 分岐（§12.9）。INSERT のみ「非 active 無視」
Phase 2/4 分担              → fetch/cache は Phase 2、保存+Realtime は Phase 4
Phase 1 insert payload      → space_pane_id キー省略（§10.3a）
query key                   → parse 関数（Phase 2）。startsWith 廃止
```

---

## 29. 関連仕様書との整合

| 本書の論点 | 関連仕様 | 追記・変更 |
|-----------|----------|-----------|
| Space 構造・表示 | [08_スペース（HOME）](./08_スペース（HOME）の仕様書.md) | タブバー・Pane 切替・fetch 条件 |
| URL・QR | [03_スペースURL機能](./03_スペースURL機能.md) | `?pane=` 追記。既存 slug URL は不変 |
| 投稿保存 | [01_投稿](./01_投稿（Hossii投稿）.md) | `space_pane_id` 付与 |
| 投稿取得・表示 | [87_表示パフォーマンス](./87_スペース表示パフォーマンス最適化.md) | query key v2・ページング filter |
| 投稿位置 | [45_投稿の位置](./45_投稿の位置を定める機能.md) | Pane ごと独立座標空間（space 内 % は維持） |
| 背景 | [24_背景設定](./24_スペース管理_各スペースの設定_背景設定.md) | デフォルト=spaces、追加=space_panes override |
| 投稿フォーム | [86_投稿フォーム項目設定](./86_投稿フォーム項目設定.md) | Pane override は partial postFields |
| ログ一覧 | [44_ログ一覧](./44_ログ一覧画面.md) [83_私のログ切替](./83_ログ一覧の私のログ切替.md) | PaneFilterSegment 追加 |
| 設定画面 | [09_管理画面UI](./09_スペース管理画面UI仕様書.md) [92_管理スペース設定](./92_管理スペース設定.md) | タブ管理・Pane selector |
| 権限 | [10_ログインユーザー](./10_ログインユーザー管理設計.md) | `isAdmin` 流用。Space 所有者なし |
| QR・共有 | [03](./03_スペースURL機能.md) §QR | Pane QR は query 付き |
| Realtime | [04_データ保存](./04_データ保存機能.md) | Pane client filter |
| 説明表示 | [91_スペース説明表示](./91_スペース説明表示.md) | **Space 共通**（Pane 非連動） |
| タグ絞込 | [26_タグ](./26_タグとフィルタリング機能.md) | 初期は Space 単位 filter 維持（§30.8） |
| モデレーション | [28_投稿非表示](./28_スペース投稿非表示.md) | 初期は Space 横断 fetch 維持 |
| 隣人 | [44_隣人システム](./44_隣人システム.md) | **Pane 非対応**（§30.7） |
| 簡易投稿 | [51_簡単投稿](./51_簡単投稿.md) | activePane に投稿 |
| スペース作成 | [09](./09_スペース管理画面UI仕様書.md) A04 | default pane 同時作成 |
| 非公開 Space | [03](./03_スペースURL機能.md) | ゲスト flow 変更なし |

**00_仕様概要.md** への追記は実装完了後でよい。

---

## 30. 境界条件・抜け漏れ

### 30.1 モバイル・レイアウト

| 項目 | 仕様 |
|------|------|
| タブバー | 横スクロール（§6.4）。safe-area 考慮 |
| 画面回転 | `LeftControlBar` / StarView 既存挙動を維持。Pane 状態は URL で復元 |
| 長いタブ名 | 省略表示（ellipsis）。最大 30 文字（入力側で制限） |
| 管理者 `＋` | スクロール末尾に固定表示（CSS `position: sticky` 等） |

### 30.2 Pane 切替中の UX

| 項目 | 仕様 |
|------|------|
| ローディング | `useSpaceHossiiFetch` の `loading` を利用。背景は **即時** resolver 切替、投稿は spinner または前 Pane 残置禁止（requestId で stale 破棄） |
| 背景画像 | Pane 切替時に `background` 変更。画像 kind は **新 URL を fetch**（既存 SpaceScreen 背景描画と同じ）。失敗時は pattern/color fallback |
| fetch 競合 | 現行 `requestIdRef` + `AbortController`（`useSpaceHossiiFetch.ts` L87–113）を Pane deps 追加で維持 |

### 30.3 操作中の Pane 切替

| 状況 | 挙動 |
|------|------|
| 投稿モーダル / クイック投稿パネル表示中 | Pane 切替時 **パネルを閉じる**（または切替不可）。未送信 draft は破棄（現行 PostScreen ローカル state と同様） |
| PostScreen 下書き | Pane 切替で draft クリア。`continuousPost` 等 DisplayPrefs は global のまま |
| 設定画面 dirty | `SpaceSettingsScreen` の `screenDirty`（L40）が true のとき Pane selector 切替で **確認ダイアログ**（既存 discard パターン流用） |
| Pane 作成失敗 | toast + リトライ。既存 Pane 一覧は維持 |
| 送信中 | 投稿ボタン disabled。Pane 切替不可 |

### 30.4 default Pane 不在

§19.2 参照。Supabase 有効時は migration で default 必須。**Synthetic default**（pane レコードなしで `spaces` のみ表示）は **デモ / migration 前フォールバック**に限定。

### 30.5 slug 重複

作成時 `validateSpaceURL` 相当（`spaceUrlUtils.ts`）を Pane slug に適用。DB `UNIQUE (space_id, slug)` で二重防御。非表示 Pane の slug も占有。

### 30.6 複数管理者同時編集

**Last-write-wins**（既存 Space 設定と同型）。Pane 一覧は保存後 `reloadPanes`。競合検出は初期スコープ外。

### 30.7 隣人スペース（訪問モード）

`visitingSpaceId !== null` 時（`SpaceScreen.tsx` L190, `useNeighborSpace`）は **Pane 非対応**:

* タブバー非表示
* 従来どおり `visitingHossiis` を `fetchHossiis(spaceId)` で取得
* 投稿・Pane 管理不可

### 30.8 タグフィルター

`hossii.spaceTagFilter.{spaceId}`（`spaceTagFilterStorage.ts`）は **初期リリースでは Space 単位のまま**。Pane 切替で tag filter は維持（意図: 同一タグで各 Pane を横断確認しやすい）。Pane 別 filter は将来 `.{paneId}` suffix。

### 30.9 モデレーション

`ModerationTab` の `fetchAllHossiisForModeration(spaceId)` は **Space 横断**（Pane filter なし）を初期維持。必要なら Pane 列表示のみ追加。

### 30.10 canvas export・スクリーンショット

`spaceCanvasExport.ts` / `SpaceScreen` export は **resolved 背景**を使用するよう Phase 5–7 で更新。Pane 非表示時も export 対象は **activePane**。

### 30.11 presentationMode・表示 prefs

`DisplayPrefsContext`（global）および `presentationModeStorage` は **Pane 非連動**（§3.3 確定）。

### 30.12 スタンプ・星マーカー

スタンプ（`stampStorage`）は Pane 非連動。`starMarkerType` は Space 共通（localStorage）。

### 30.13 非公開 Space・招待

`isPrivate` / ゲスト入室（`App.tsx` GuestEntryScreen）は **Space 単位**。Pane URL も private チェック後に解決。

### 30.14 Pane メタデータの Realtime

**初期不要。** Pane 変更は管理者操作頻度が低く、保存後 `reloadPanes` / 画面再訪で足りる。`space_panes` Realtime 購読は Phase 10 検討。

### 30.15 データ export

`ExportRecordTab` は Space 横断のまま。Pane 別 export は初期スコープ外。

### 30.16 非表示 Pane の URL フォールバック（確定）

| 利用者 | `?pane={hiddenSlug}` 直リンク |
|--------|------------------------------|
| 一般参加者 | RLS で pane 取得不可 → **default Pane へフォールバック**（toast 任意） |
| 管理者 | **Space 画面では閲覧不可**。設定画面の Pane 一覧で非表示 Pane を確認・再表示 |

RLS により anon / 一般セッションから非表示 Pane の slug 自体が漏れない（§18.1）。管理者セッションでも **Space 画面 UI は hidden slug を active にしない**。

---
