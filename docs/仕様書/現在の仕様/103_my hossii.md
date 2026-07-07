この機能は、単なるプロフィール画像ではなく、**「アカウントの活動が、Hossiiという存在として空間に現れる仕組み」**として設計すると、Hossiiらしさがかなり強くなります。

既存企画でも「個人の軌跡」や「誰が何をしたかを識別し、その人の活動を景色として残す」という考え方があり、今回のマイHossiiはその常設版として自然に接続できます。 

# 103 マイHossii機能

> **分類:** `[Core / Account / Profile / Space / Character]`  
> **機能名:** マイHossii登録・スペース表示・活動連動  
> **ステータス:** ✅ Phase 1〜5 実装済み / Phase 6 は仕様案のみ  
> **最終更新:** 2026-07-07  
> **目的:** ログインユーザーごとの存在をHossiiとして空間上に表現し、ユーザーの活動、感情、継続状況をスペースの景色へ反映する  
> **関連仕様書:**  
> - `04_データ保存機能.md`
> - `08_スペース（HOME）の仕様書.md`
> - `10_ログインユーザー管理設計.md`
> - `12_画像投稿.md`
> - `27_User別.md`
> - `32_Hossii motion.md`
> - `81_投稿者別まとめ表示モード.md`
> - `87_スペース表示パフォーマンス最適化.md`
> - `92_管理スペース設定.md`
> - `101_管理者発行参加者アカウント.md`

---

## 1. 概要

Supabase Authのログインアカウントごとに、1体の「マイHossii」を登録できるようにする。

登録されたマイHossiiは、そのユーザーが参加しているスペースのメイン画面に登場する。

マイHossiiは単なるプロフィール画像ではなく、そのユーザーの最近の活動や状態を、スペースの景色の中に表現するキャラクターである。

マイHossiiには次の情報が紐づく。

- ログインアカウント
- スペース内で使用しているニックネーム
- 選択または登録したHossii画像
- 現在のスペース内の最近のログ
- 最近の活動日時
- 表情
- 短い吹き出し
- スペース上の表示状態

---

## 2. 体験の基本構造

### 2-1. スペースHossii

スペース自体を象徴する中心キャラクター。

既存の `HossiiLive` を使用し、投稿反応、自発セリフ、移動、表情等の既存機能を維持する。

### 2-2. マイHossii

ログインユーザー本人を表す軽量キャラクター。

スペースHossiiとは別の表示レイヤーで複数体表示する。

### 2-3. 表示例

登録済みユーザーが5人いるスペースでは、次の合計6体を表示する。

- スペースHossii：1体
- マイHossii：5体

---

## 3. 目的

### 3-1. 個人の存在を空間として表現する

参加者を名前の一覧だけで示すのではなく、Hossiiとしてスペース内に存在させる。

### 3-2. 日々の活動を景色へ反映する

投稿やログをカードだけに閉じず、活動した本人のHossiiの表情、動き、吹き出しへ接続する。

### 3-3. アカウントへの愛着をつくる

ニックネームと同様に、自分のHossiiを持つことで、アカウントと参加スペースへの愛着を高める。

### 3-4. 人と活動のつながりを見えるようにする

誰が最近どのように活動したかを、Hossiiを起点に確認できるようにする。

---

## 4. 用語

### マイHossii

ログインアカウントごとに登録されるHossiiキャラクター。

### スペースHossii

特定のユーザーには属さず、スペースを象徴する中心Hossii。

### Hossiiプリセット

運営が用意する、選択可能な既存Hossii画像。

### 最近のログ

対象ユーザーが、現在表示中のスペース内で作成した直近の投稿。

### Hossii状態

最近のログ、感情、活動日時等から導出する、表情、動き、吹き出し等の表示状態。

### 表示対象参加者

現在のスペースとの参加関係を確認でき、かつマイHossiiを登録済みのログインユーザー。

---

## 5. 現在の実装構成

| 対象 | 現在の実装 | 主な関連箇所 |
|---|---|---|
| 認証 | Supabase Auth | `AuthContext.tsx` |
| 端末プロフィール | `profiles`、localStorageミラー | `profilesApi.ts`, `profileStorage.ts` |
| 登録ユーザープロフィール | `user_profiles` | `userProfilesApi.ts` |
| スペース別ニックネーム | `space_nicknames` | `profilesApi.ts` |
| 発行参加者 | `space_participant_accounts` | `participantAccountsApi.ts` |
| スペースHOME | 背景、投稿バブル、スペースHossii1体 | `SpaceScreen.tsx` |
| スペースHossii | `HossiiLive` 1インスタンス | `HossiiLive.tsx` |
| 投稿 | `hossiis` | `hossiisApi.ts`, `useSpaceHossiiFetch.ts` |
| 投稿者別集約 | author単位のグループ化 | `groupHossiisByAuthor.ts` |
| Realtime | `hossiis` をスペース単位購読 | `HossiiStoreProvider.tsx` |
| 画像Storage | 公開バケット `hossii-images` | `imageStorageApi.ts` |
| スペースキャラ設定 | `character_image_url` 等 | `CharacterTab.tsx`, `resolvePaneCharacter.ts` |

### 現在の主な不足

- マイHossii設定の保存先
- アカウント画面の設定UI
- スペース参加者ロスターの取得API
- 複数のマイHossiiを表示するレイヤー
- 決定論的な配置
- ホバー・タップによるプロフィール表示
- 最近のログとの連動
- スペース単位のON/OFF
- `characterImageUrl` とメイン画面の `HossiiLive` の接続

---

## 6. 対象ユーザー

### 6-1. 登録できるユーザー

マイHossiiを登録できるのは、Supabase Authのログインユーザーのみとする。

対象には次を含む。

- メールアドレスとパスワードでログインするユーザー
- OAuthでログインするユーザー
- 管理者が発行した参加者IDとパスワードでログインするユーザー
- 管理者アカウント

### 6-2. ゲストユーザー

ゲストユーザーはマイHossiiを登録できない。

ゲストの投稿やニックネーム等は既存仕様を維持する。

初期リリースでは、ゲスト用の一時Hossiiは作成しない。

### 6-3. 未登録ユーザー

ログインユーザーであっても、マイHossiiが未登録の場合はスペース画面にマイHossiiを表示しない。

`AccountScreen` に登録を促すUIを表示する。

---

## 7. 基本ルール

### 7-1. 所有数

1ログインアカウントにつき、マイHossiiは1体とする。

### 7-2. 全スペース共通

同じユーザーが複数スペースへ参加している場合も、同一のマイHossiiを使用する。

スペース別のマイHossii設定は初期リリースに含めない。

### 7-3. ニックネーム

マイHossii専用の名前は持たない。

スペース上では、次の順番でニックネームを解決する。

1. `space_nicknames` の対象スペース用ニックネーム
2. `profiles.default_nickname`
3. `user_profiles.username`

### 7-4. スペース単位の有効化

スペース設定に `my_hossii_enabled` を追加する。

- `false`：スペースHossii1体のみ表示
- `true`：スペースHossii1体と、登録済み参加者のマイHossiiを表示

デフォルトは `false` とし、既存スペースの表示を変えない。

設定UIは `CharacterTab` に配置する。

---

## 8. マイHossii登録

### 8-1. 登録場所

既存の `AccountScreen` に「マイHossii」セクションを追加する。

独立した新規ページは作成しない。

### 8-2. 設定項目

- 現在のマイHossii
- プリセットから選ぶ
- 画像から登録
- カスタムして作る
- 保存
- キャンセル

### 8-3. Phase 1で利用できる方式

Phase 1では、プリセットからの選択のみ実装する。

### 8-4. 画像登録

画像アップロードはPhase 5で実装する。

Phase 1では選択肢を表示してもよいが、「Coming soon」または無効状態とする。

### 8-5. カスタム作成

目、口、色、形、装飾等を組み合わせるMii形式の作成機能。

初期リリースには含めず、次の表示とする。

> カスタムして作る  
> Coming soon

カスタム作成はPhase 6の別仕様書で扱う。

---

## 9. Hossiiプリセット

### 9-1. 管理方法

初期リリースではDBテーブルを作らず、コードで定義する。

### 9-2. 利用アセット

既存の次のアセットを候補とする。

- `public/hossii/idle/`
- `public/hossii/extra/`

emotion画像は、単独の基本プリセットとして適切か確認したうえで使用する。

### 9-3. 型

```ts
type HossiiPreset = {
  key: string
  label: string
  imagePath: string
}
```

### 9-4. 保存値

DBには画像URLそのものではなく、原則として `preset_key` を保存する。

表示時にコード定義から画像パスを解決する。

---

## 10. データモデル

### 10-1. 保存先

マイHossiiは `user_profiles` に保存する。

専用の `user_hossiis` テーブルは作成しない。

### 10-2. 追加カラム

```text
hossii_source_type
hossii_preset_key
hossii_image_path
hossii_updated_at
```

想定内容：

| カラム | 内容 |
|---|---|
| `hossii_source_type` | `preset` または `upload` |
| `hossii_preset_key` | コード定義されたプリセットキー |
| `hossii_image_path` | Phase 5で使用するStorage path |
| `hossii_updated_at` | 最終更新日時 |

### 10-3. Phase 1で使用する値

```text
hossii_source_type = 'preset'
hossii_preset_key
hossii_updated_at
```

`hossii_image_path` はPhase 5まで未使用でよい。

### 10-4. 制約

- `hossii_source_type` は `preset` または `upload`
- `source_type = preset` の場合は `hossii_preset_key` を必須とする
- `source_type = upload` の場合は `hossii_image_path` を必須とする
- 本人のみ更新できる既存RLSを維持する

### 10-5. 表示状態の保存

表情、吹き出し、最近の状態はDBに永続化しない。

既存の `hossiis` データからフロントエンドで導出する。

---

## 11. 表示対象参加者

### 11-1. 基本方針

Phase 1〜2では、新しいメンバーシップテーブルを作らない。

表示対象は既存の次の情報から導出する。

- `space_nicknames`
- `space_participant_accounts`
- `user_profiles`

### 11-2. 表示条件

次のすべてを満たすユーザーを表示する。

1. 次のいずれかを満たす
   - 対象スペースに `space_nicknames` が存在する
   - 対象スペースの有効な `space_participant_accounts` に紐づく
2. Supabase Authのログインユーザーとして特定できる
3. `user_profiles` が存在する
4. マイHossiiが登録済み
5. 退出または無効化されていない

### 11-3. 表示対象に含めないもの

- ゲストユーザー
- マイHossii未登録ユーザー
- `space_participant_accounts.status = 'revoked'` のユーザー
- `space_nicknames` 行が削除され、他の有効な参加経路もないユーザー
- 投稿履歴だけが存在するユーザー

### 11-4. UUID形式による判定の禁止

`profile_id` がUUID形式であることだけを根拠に、ログインユーザーと判定してはならない。

ゲストの `profiles.id` もUUID形式になり得る。

必ず `user_profiles` または認証ユーザーとの関連を確認する。

---

## 12. 参加者取得RPC

### 12-1. 採用理由

現在のRLSでは、クライアントから次を直接結合して取得できない。

- 他ユーザーの `user_profiles`
- 一般参加者から見た `space_participant_accounts`

複雑なRLSポリシーを広げるより、必要な列だけを返すSecurity Definer RPCを1本設ける。

### 12-2. RPC名

```text
list_my_hossii_participants(p_space_id text)
```

実際の `space_id` 型がUUID等である場合は、既存スキーマに合わせて変更する。

### 12-3. 返却項目

必要最小限の次の項目だけを返す。

```text
user_id
nickname
hossii_source_type
hossii_preset_key
hossii_image_path
hossii_updated_at
```

メールアドレス、ログインID、権限情報等は返さない。

### 12-4. 取得経路

#### 経路A

`space_nicknames` に対象スペースのニックネームがあり、`user_profiles` と一致するログインユーザー。

#### 経路B

対象スペースの `space_participant_accounts` に存在し、`status = 'active'` である発行参加者。

### 12-5. 重複排除

同じユーザーが経路AとBの両方に存在する場合も、1ユーザー1行にする。

ニックネームは非空の値を優先する。

### 12-6. 概念SQL

実際のカラム型と主キー名はmigration作成前に現行DBと生成型で再確認する。

```sql
WITH candidates AS (
  SELECT
    up.id AS user_id,
    sn.nickname
  FROM space_nicknames sn
  INNER JOIN user_profiles up
    ON up.id::text = sn.profile_id
  WHERE sn.space_id = p_space_id
    AND btrim(sn.nickname) <> ''

  UNION

  SELECT
    spa.auth_user_id AS user_id,
    COALESCE(
      NULLIF(btrim(sn.nickname), ''),
      NULLIF(btrim(p.default_nickname), ''),
      up.username,
      ''
    ) AS nickname
  FROM space_participant_accounts spa
  INNER JOIN user_profiles up
    ON up.id = spa.auth_user_id
  LEFT JOIN space_nicknames sn
    ON sn.space_id = p_space_id
   AND sn.profile_id = spa.auth_user_id::text
  LEFT JOIN profiles p
    ON p.id = spa.auth_user_id::text
  WHERE spa.space_id = p_space_id
    AND spa.status = 'active'
),
deduped AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    nickname
  FROM candidates
  ORDER BY user_id, (nickname <> '') DESC, nickname
)
SELECT
  d.user_id,
  d.nickname,
  up.hossii_source_type,
  up.hossii_preset_key,
  up.hossii_image_path,
  up.hossii_updated_at
FROM deduped d
INNER JOIN user_profiles up
  ON up.id = d.user_id
WHERE up.hossii_source_type IS NOT NULL
  AND (
    up.hossii_source_type <> 'preset'
    OR up.hossii_preset_key IS NOT NULL
  )
  AND (
    up.hossii_source_type <> 'upload'
    OR up.hossii_image_path IS NOT NULL
  );
```

### 12-7. セキュリティ要件

RPCは次を満たす。

- `SECURITY DEFINER`
- 関数の `search_path` を固定する
- 必要なテーブルをスキーマ修飾する
- `PUBLIC` への無条件実行権限を付けない
- 返却列を必要最小限に限定する
- `p_space_id` を通じて別スペースの情報を混在させない
- 利用可能なロールはスペース画面のアクセス仕様に合わせる

### 12-8. 実行権限

基本は `authenticated` に付与する。

スペース画面をゲストも閲覧でき、ゲストにもマイHossiiを見せる必要がある場合のみ、`anon` への実行権限を追加する。

`anon` を許可する場合も、返却内容はニックネームとHossii表示情報だけに限定する。

### 12-9. クエリ数

`my_hossii_enabled = true` の場合のみ、画面初期化時にRPCを1回呼び出す。

| 処理 | 追加クエリ |
|---|---:|
| スペース設定取得 | 0 |
| マイHossii参加者取得 | 1 |
| 最新ログ取得 | 0 |
| マイHossii専用Realtime | 0 |

---

## 13. 発行参加者の `user_profiles`

### 13-1. 現状の問題

管理者発行アカウントは `auth.users` に存在しても、`user_profiles` が作成されていない場合がある。

`user_profiles` がなければ、マイHossiiを保存できず、表示対象にもならない。

### 13-2. 正式方針

Phase 1で、発行参加者、OAuthユーザー等を含むログイン成功時に、`user_profiles` の存在を保証する。

### 13-3. 作成タイミング

初回ログイン後、認証セッション確立時に不足していればupsertする。

### 13-4. 初期値

既存のサインアップ処理と命名規則を流用する。

発行参加者については、既存の表示用情報から安全な初期 `username` を設定する。

ログインIDそのものに秘匿性がある場合は、画面に露出する初期名としてそのまま使用しない。

---

## 14. 描画構造

### 14-1. 基本方針

既存 `HossiiLive` を参加者数分複製しない。

### 14-2. 採用する構成

```text
SpaceScreen
├── 背景
├── 投稿バブル
├── MyHossiiLayer
│   ├── MyHossiiAvatar
│   ├── MyHossiiAvatar
│   └── ...
├── パーティクル
└── HossiiLive
```

### 14-3. スペースHossii

- 既存 `HossiiLive` を維持
- 投稿反応、自発セリフ、移動、タップ反応等を維持
- `characterImageUrl` を待機画像へ接続
- `decorative=true` は使用しない

### 14-4. `characterImageUrl` 接続方法

`HossiiLive` に `idleImageOverride` 相当のpropsを追加する。

このpropsは、泳ぎ、自発セリフ、タップ反応等を維持したまま、通常時の待機画像だけを差し替える。

画像ありの場合に `decorative` モードへ切り替える方法は採用しない。

### 14-5. マイHossii

新規に次を追加する。

```text
MyHossiiLayer
MyHossiiAvatar
```

### 14-6. `MyHossiiLayer` の責務

- `my_hossii_enabled` の確認
- 参加者RPCの呼び出し
- 参加者一覧の重複排除済みデータ管理
- 画像パスの解決
- 配置計算
- アニメーションtierの決定
- Phase 3以降の最近のログ導出
- 各Avatarへのprops渡し

### 14-7. `MyHossiiAvatar` の責務

- Hossii画像の表示
- 軽い浮遊
- 決定論的な初期位置
- ホバー
- タップ
- 選択状態
- ニックネーム
- 簡易表情
- 短い吹き出し
- 詳細表示への導線

### 14-8. 持たせないもの

- 独立したRealtime購読
- 独立した投稿取得
- 複雑なBrain Hook
- Avatarごとの長時間タイマー
- スペースHossiiと同等の自発行動
- AvatarごとのDBアクセス

---

## 15. 描画レイヤー

初期案：

```text
spaceExportRoot
├── 背景
├── 投稿バブル層
├── MyHossiiLayer       z-index: 90前後
├── HossiiLive          z-index: 100前後
├── パーティクル        既存値に合わせる
└── 操作・選択UI        最前面
```

最終値は既存CSSと照合して決定する。

基本方針：

- マイHossiiはスペースHossiiより後ろ
- 操作UIより下
- 投稿詳細やモーダルより下
- Hossii自体のタップ領域は操作可能

---

## 16. 配置

### 16-1. 決定論的位置

`userId + spaceId` をseedとして、同じユーザーが同じスペースを再表示したときに大きく位置が変わらない配置を生成する。

DBへ位置は保存しない。

### 16-2. 参考実装

既存の `bubblePosition.ts` にある `idSeed` パターンを参考にする。

### 16-3. 配置方式

初期リリースでは次のいずれかの簡易方式とする。

- 配置スロット
- seed付き散布
- 行・円弧・島状の複数領域への振り分け

### 16-4. 安全領域

次を避ける。

- 主要操作UI
- 画面端
- スペースHossiiの中心領域
- 投稿操作が集中する領域
- スマートフォンの下部ナビゲーション

### 16-5. 衝突判定

初期リリースでは高度なリアルタイム衝突判定を実装しない。

配置スロットの重複を抑えることで対応する。

---

## 17. 表示数とパフォーマンス

### 17-1. 全員表示

表示対象条件を満たすマイHossiiは全員表示する。

人数上限による非表示は初期リリースでは行わない。

### 17-2. アニメーションtier

初期基準：

| 表示人数 | tier | 表現 |
|---:|---|---|
| 1〜5体 | `full` | 軽い浮遊 |
| 6〜12体 | `light` | 移動幅・更新頻度を低下 |
| 13体以上 | `none` | 静止またはCSSによる最小浮遊 |

実装時に実機確認し、閾値は調整可能とする。

### 17-3. 実装上の制約

- AvatarごとにJSタイマーを持たせない
- 可能な限りCSSアニメーションを使用する
- 非表示状態のAvatarは描画しない
- `prefers-reduced-motion` に対応する
- 既存の `animationLevel.ts` と概念を揃える
- 投稿バブルの描画パフォーマンスを悪化させない

---

## 18. PC・スマートフォン操作

### 18-1. PC

#### ホバー

- ニックネーム
- 短い状態
- 必要に応じて最新ログの短い一文

#### クリック

- 詳細ポップオーバー
- 現在のスペース内の直近3件
- 投稿日時
- 感情または数値等の既存項目

### 18-2. スマートフォン

#### 1回タップ

- ニックネーム
- 短い状態
- 詳細ボタン

#### 詳細表示

- 同一ポップオーバーまたは詳細パネル内に直近3件を表示

### 18-3. 既存操作との競合防止

- マイHossiiタップで逃げる動作は行わない
- マイHossii操作時はイベント伝播を止める
- 背景操作や投稿カード操作を妨げない
- タップ領域は画像より少し広く確保する
- 投稿詳細、モーダル等が開いている場合はそちらを優先する

---

## 19. 最近のログ

### 19-1. 対象

現在表示中のスペース内の `hossiis` のみ。

別スペースのログは表示しない。

### 19-2. 件数

直近3件。

### 19-3. 取得方法

新規のユーザー別クエリは行わない。

既存の次を流用する。

- `useSpaceHossiiFetch`
- `HossiiStoreProvider`
- `groupHossiisByAuthor`
- `AuthorTimelineModal` の表示構造

既存store内の投稿をauthor単位にまとめ、各ユーザーの直近3件を導出する。

### 19-4. Realtime

既存の `hossiis` Realtime更新でstoreが更新された際、該当ユーザーの表示データを再導出する。

マイHossii専用Realtimeチャンネルは追加しない。

### 19-5. 除外

- `is_hidden` 等の非表示投稿
- 既存権限で閲覧できない投稿
- 下書きがある場合は下書き
- 削除済み投稿

### 19-6. ログがない場合

次のような空状態を表示する。

- 「この場所での記録はまだありません」
- 「最初の一歩を待っています」

---

## 20. 表情・状態連動

### 20-1. 基本方針

心理状態や人格を断定しない。

最近の活動を軽く表現する演出に限定する。

### 20-2. 導出元

- 最新ログの有無
- 最新ログの日時
- 最新ログの `emotion`
- 投稿カテゴリ
- 数値またはタグ

### 20-3. 初期状態

| 状態 | 条件例 | 表現例 |
|---|---|---|
| `default` | 判定対象なし | 通常 |
| `new` | 登録直後 | きらっと登場 |
| `active` | 最近投稿あり | 軽く元気に浮遊 |
| `happy` | ポジティブ感情 | 笑顔 |
| `thinking` | 気づき・考察系ログ | 考える表情 |
| `quiet` | 一定期間投稿なし | 静かに浮遊 |
| `resting` | 休息系の感情 | ゆっくりした表情 |

### 20-4. 避ける表現

- 病んでいる
- やる気がない
- 悲しい人
- 怒っている人
- 問題がある

ユーザー本人の状態を断定する文言は使用しない。

---

## 21. 吹き出し

### 21-1. 種類

#### 最新ログ引用型

最近のログの一部を短く表示する。

#### 状態変換型

活動をHossiiらしい短い言葉へ変換する。

例：

- 「今日は3つ進めたよ」
- 「新しい気づきがあったみたい」
- 「次の一歩を考え中」
- 「少しひと休み中」

#### システムメッセージ型

- 「はじめまして」
- 「ここにやってきました」
- 「最初の一歩を待っています」

### 21-2. 表示文字数

20〜40文字程度を基本とする。

長いログは省略する。

### 21-3. 表示頻度

全員の吹き出しを常時表示しない。

初期実装は次を基本とする。

- ホバー・タップ時
- 選択中
- 最新活動がある一部のHossii
- 一定時間に少数のみ

---

## 22. 画像登録（Phase 5）

### 22-1. Storage

既存 `hossii-images` バケットを利用する。

想定パス：

```text
avatars/{auth_uid}/{filename}
```

固定ファイル名を使う場合は、ブラウザキャッシュ更新方法を考慮する。

### 22-2. 流用

`imageStorageApi.ts` の次を流用する。

- 圧縮
- MIME検証
- ファイルサイズ確認
- アップロード処理
- 公開URLまたはpath管理

### 22-3. セキュリティ

- 認証ユーザーのみアップロード可
- 自分のUID配下のみ書き込み可
- 他ユーザーの画像を上書きできない
- 許可形式を限定する
- SVGを許可する場合は別途安全性を確認する

### 22-4. 削除・更新

新しい画像へ更新した場合の古いファイル削除を定義する。

削除失敗時も、プロフィール更新自体を破損させない。

---

## 23. スペース設定UI

`CharacterTab` に次を追加する。

### 表示例

**マイHossiiを表示**

参加者が登録したマイHossiiを、スペースの景色に登場させます。

- OFF：スペースHossiiのみ
- ON：スペースHossii＋参加者のマイHossii

### 注意

- デフォルトOFF
- 管理権限のあるユーザーのみ変更可能
- ONにしてもマイHossii未登録者は表示されない
- 設定変更後は既存のsettings更新フローに従う

---

## 24. データ取得フロー

```text
SpaceScreen
  ↓ space_settingsを既存取得
my_hossii_enabledを確認
  ├─ false → MyHossiiLayerを表示しない
  └─ true
       ↓
     useMyHossiiParticipants
       ↓
     list_my_hossii_participants RPCを1回
       ↓
     MyHossiiLayer
       ├─ preset/upload画像を解決
       ├─ userId + spaceIdで配置計算
       ├─ 人数からanimation tierを決定
       └─ MyHossiiAvatarへprops
```

Phase 3以降：

```text
既存hossiis store
  ↓
groupHossiisByAuthor
  ↓
参加者user_idとauthor_idを照合
  ↓
各ユーザーの直近3件
  ↓
MyHossiiLayerからAvatar・詳細UIへprops
```

---

## 25. 採用する設計

- `user_profiles` へのカラム追加
- プリセットのコード管理
- スペース単位 `my_hossii_enabled`
- Security Definer RPC 1本
- `MyHossiiLayer` と `MyHossiiAvatar`
- スペースHossiiは既存 `HossiiLive`
- `idleImageOverride` 相当でスペースキャラ画像を接続
- 既存投稿storeから直近3件を導出
- 既存Realtimeを流用
- 決定論的配置
- 人数によるアニメ軽量化

---

## 26. 採用しない設計

- 専用 `user_hossiis` テーブル
- マイHossii専用メンバーシップテーブル
- `HossiiLive` の人数分複製
- Avatarごとの投稿クエリ
- マイHossii専用Realtime
- Phase 1での画像アップロード
- Phase 1でのカスタム作成
- 高度な衝突判定
- AIによる感情分析
- 心理状態を断定する表現
- 位置情報のDB保存
- 人数超過による非表示

---

## 27. 変更予定ファイル

### 27-1. Phase 1

| ファイル | 新規/修正 | 変更内容 |
|---|---|---|
| `supabase/migrations/YYYYMMDD_add_my_hossii_to_user_profiles.sql` | 新規 | Hossii用カラムと制約 |
| `src/core/assets/hossiiPresets.ts` | 新規 | プリセット定義 |
| `src/core/utils/userProfilesApi.ts` | 修正 | 型、取得、保存API |
| `src/components/AccountScreen/MyHossiiSettingsSection.tsx` | 新規 | 設定UI |
| `src/components/AccountScreen/MyHossiiSettingsSection.module.css` | 新規 | 設定UIスタイル |
| `src/components/AccountScreen/AccountScreen.tsx` | 修正 | セクション追加 |
| `src/components/AccountScreen/AccountScreen.module.css` | 修正 | スタイル追加 |
| `src/core/contexts/AuthContext.tsx` | 修正候補 | `user_profiles` 作成保証 |

### 27-2. Phase 2

| ファイル | 新規/修正 | 変更内容 |
|---|---|---|
| `supabase/migrations/YYYYMMDD_add_my_hossii_enabled.sql` | 新規 | スペース設定フラグ |
| `supabase/migrations/YYYYMMDD_list_my_hossii_participants_rpc.sql` | 新規 | 参加者取得RPC |
| `src/core/types/settings.ts` | 修正 | `myHossiiEnabled` |
| `src/core/types/myHossii.ts` | 新規 | マイHossii型 |
| `src/core/utils/spaceSettingsApi.ts` | 修正 | 設定read/write |
| `src/core/utils/settingsStorage.ts` | 修正 | デフォルトfalse |
| `src/core/utils/myHossiiParticipantsApi.ts` | 新規 | RPCラッパー |
| `src/core/utils/myHossiiPosition.ts` | 新規 | 配置計算 |
| `src/core/utils/myHossiiAnimationLevel.ts` | 新規 | tier判定 |
| `src/core/utils/resolveMyHossiiImage.ts` | 新規 | 画像解決 |
| `src/core/hooks/useMyHossiiParticipants.ts` | 新規 | 条件付きfetch |
| `src/components/MyHossii/MyHossiiLayer.tsx` | 新規 | レイヤー |
| `src/components/MyHossii/MyHossiiAvatar.tsx` | 新規 | 軽量Avatar |
| `src/components/MyHossii/MyHossiiLayer.module.css` | 新規 | レイヤースタイル |
| `src/components/MyHossii/MyHossiiAvatar.module.css` | 新規 | Avatarスタイル |
| `src/components/SpaceScreen/SpaceScreen.tsx` | 修正 | レイヤー挿入、キャラ画像接続 |
| `src/components/Hossii/HossiiLive.tsx` | 修正 | idle画像差し替えprops |
| `src/components/SpaceSettingsScreen/CharacterTab.tsx` | 修正 | ON/OFFトグル |
| `src/components/SpaceSettingsScreen/SpaceSettingsScreen.tsx` | 修正 | settings受け渡し |
| `src/core/utils/spaceSettingsApi.test.ts` | 修正 | フラグのテスト |

### 27-3. Phase 3

- 最近のログ導出utilまたはselector
- 詳細ポップオーバー
- ホバー・タップUI
- `AuthorTimelineModal` の流用または共通化
- `MyHossiiLayer` への既存store接続

### 27-4. Phase 4

- 表情・状態の導出util
- 吹き出し生成
- 表示頻度制御
- reduced motion対応の確認

### 27-5. Phase 5

- Hossii画像アップロードAPI
- Storage RLS
- 画像選択UI
- プレビュー
- 更新・削除

---

## 28. Phase計画

### Phase 0｜正式仕様書確定

#### 目的

本仕様を現在の実装名とDB構成に適合させる。

#### 完了条件

- 本仕様書が確定している
- 参加者取得RPCの方針が確定している
- Phase 1とPhase 2の変更範囲が確定している
- コード、DBは未変更

---

### Phase 1｜プリセット登録

#### 目的

ログインユーザーがアカウント画面からマイHossiiを選択・保存できるようにする。

#### 対象

- `user_profiles` カラム
- プリセット定義
- `AccountScreen`
- 保存API
- `user_profiles` 作成保証
- Coming soon表示

#### 実装しないもの

- スペース画面への表示
- 参加者RPC
- 画像アップロード
- 最近のログ
- 表情・吹き出し

#### 受入条件

- ログインユーザーがプリセットを選択できる
- 保存できる
- 再ログイン後も設定が残る
- ゲストは保存できない
- 発行参加者でも `user_profiles` が保証される
- カスタム・画像はComing soon

#### ロールバック

- UI追加を取り消す
- API拡張を取り消す
- 追加カラムは他機能が利用していないことを確認して戻す

---

### Phase 2｜スペース表示

#### 目的

スペースHossiiと複数のマイHossiiを同時に表示する。

#### 対象

- `my_hossii_enabled`
- 参加者RPC
- `MyHossiiLayer`
- `MyHossiiAvatar`
- 決定論的配置
- アニメーションtier
- `characterImageUrl` 接続

#### 実装しないもの

- 直近3件の詳細
- 感情連動
- 吹き出し連動
- 画像アップロード

#### 受入条件

- OFFではスペースHossiiのみ
- ONでは登録済み参加者を全員表示
- 5人登録時に合計6体表示
- 未登録者、ゲスト、revokedは表示しない
- 同一ユーザーは重複しない
- 再読込で位置が安定する
- スペース設定画像が中心Hossiiへ反映される
- 人数に応じてアニメが軽量化される
- RPC呼び出しはON時の1回のみ

#### ロールバック

- `my_hossii_enabled` をfalseに戻す
- `MyHossiiLayer` の呼び出しを外す
- RPCの実行権限を取り消す
- スペースHossiiは既存画像へフォールバック可能にする

---

### Phase 3｜プロフィール・最近のログ

#### 目的

マイHossiiから本人のニックネームと最近の活動を確認できるようにする。

#### 対象

- PCホバー
- PCクリック
- スマートフォンタップ
- 直近3件
- 詳細ポップオーバー
- 自分のHossii判別

#### 受入条件

- 現在のスペース内のログだけが表示される
- 直近3件が表示される
- 非表示投稿が出ない
- 別スペースのログが混ざらない
- ユーザーごとの追加クエリが発生しない
- 新規投稿が既存Realtime経由で反映される

---

### Phase 4｜表情・吹き出し

#### 目的

最近のログに応じて、マイHossiiの状態を軽く表現する。

#### 対象

- emotionとの連動
- 活動日時
- 状態導出
- 短い吹き出し
- 表示頻度制御

#### 受入条件

- 心理状態を断定しない
- 全Hossiiが常時吹き出しを出さない
- 表情が存在しない場合もデフォルト表示できる
- 多人数時に負荷が増えすぎない

---

### Phase 5｜画像登録

#### 目的

ユーザーが画像をマイHossiiとして登録できるようにする。

#### 対象

- Storage path
- RLS
- 圧縮
- MIME検証
- アップロード
- 更新・削除
- プレビュー

#### 受入条件

- 自分の画像だけを更新できる
- 他人の画像を上書きできない
- 不正形式を拒否する
- 画像読込失敗時はプリセットまたはデフォルトへ戻る

---

### Phase 6｜カスタム作成

別仕様書で扱う。

---

## 29. 受入条件一覧

### 登録

- 1アカウントにつき1体のみ保存される
- プリセットキーが正しく保存される
- 再ログイン後も維持される
- ゲストは登録できない
- マイHossii未登録でも既存機能は利用できる

### スペース設定

- 管理者がON/OFFを変更できる
- デフォルトはOFF
- OFFで既存スペースの表示が変わらない

### 表示

- ON時のみマイHossiiを取得する
- スペースHossiiと共存する
- 5人登録で6体表示される
- 未登録ユーザーは表示されない
- ゲストは表示されない
- revokedユーザーは表示されない
- 同じユーザーが重複しない

### 配置

- 同じスペースで再読込しても大きく位置が変わらない
- 操作UIを塞がない
- 画面外に大きくはみ出さない

### パフォーマンス

- ON時の追加初期クエリは原則1回
- ユーザー別N+1が発生しない
- 専用Realtimeを追加しない
- 多人数時にアニメを軽量化する
- AvatarごとのJSタイマーを増やさない

### ログ

- 対象スペース内の直近3件
- 非表示投稿は除外
- 既存閲覧権限に従う
- Realtime更新は既存store経由

### セキュリティ

- RPCがメールやログイン情報を返さない
- RPCのsearch pathが固定される
- `PUBLIC` に不要な権限を与えない
- 本人以外がマイHossii設定を更新できない
- Storageは本人のパスだけ書き込める

---

## 30. テスト方針

### 30-1. Unit

- プリセットキー解決
- `my_hossii_enabled` のデフォルト
- `userId + spaceId` から同じ位置が生成される
- 人数からanimation tierが正しく決まる
- 状態導出
- 非表示投稿除外
- 直近3件抽出

### 30-2. API・DB

- 本人がマイHossiiを保存できる
- 他人の `user_profiles` を更新できない
- RPCが対象スペースだけを返す
- RPCがゲストを返さない
- RPCがrevokedを返さない
- RPCが重複ユーザーを1行にする
- RPCが必要列以外を返さない

### 30-3. UI

- AccountScreenのプリセット選択
- ゲスト表示
- ON/OFF
- 0人、1人、5人、13人以上
- PCホバー
- PCクリック
- スマートフォンタップ
- reduced motion
- 画像読込失敗

---

## 31. ロールバック方針

### Phase 1

- AccountScreenのマイHossiiセクションを非表示
- 保存APIの利用を停止
- カラムは未使用状態でも既存機能へ影響しない

### Phase 2

- `my_hossii_enabled` を全スペースfalseへ戻す
- `MyHossiiLayer` を呼び出さない
- RPC実行権限を取り消す
- `HossiiLive` の画像差し替えpropsを未指定にして既存画像へ戻す

### Phase 3以降

- ホバー・詳細UIを無効化
- 状態導出をデフォルトへ戻す
- 既存投稿storeは変更しない

---

## 32. 実装原則

- 各Phaseを単独で確認、ロールバックできるようにする
- migrationはPhaseごとに分ける
- 本番DBへ直接適用しない
- 既存RLSを不用意に広げない
- 他ユーザー情報の取得はRPCの返却列を限定する
- 既存認証フローを壊さない
- 既存スペースの表示はデフォルトOFFで維持する
- 大規模なStoreやContextを新設しない
- `HossiiLive` の責務を増やしすぎない
- マイHossiiは軽量表示を優先する
- 最近のログは既存storeから導出する
- カスタム作成を先行実装しない
- 推測でカラム型や主キーを確定せず、migration前に現行型を再確認する

---

## 33. 実装前の最終確認事項

以下は設計判断ではなく、実装開始前にコードとDBで確認する項目である。

1. `user_profiles` の主キーが `id` か `uid` か
2. `space_nicknames.profile_id` にログイン時どのIDが保存されるか
3. `space_participant_accounts.auth_user_id` の実際のカラム名と型
4. `space_settings` が物理カラム方式かJSON方式か
5. `SpaceScreen` の正確なz-index構成
6. 公開スペースでゲストにもマイHossiiを見せるか
7. 発行参加者の初期 `username` に利用できる安全な値
8. `hossiis.is_hidden` 等の実カラム名
9. `characterImageUrl` の解決済みURLをどこで取得しているか
10. `public/hossii/` のうちプリセットとして公開可能な画像一覧

これらを確認しても、本仕様の基本構造は変更しない。

---

## 34. 完成状態

マイHossii機能の完成状態は次のとおり。

1. ログインユーザーがアカウント画面から自分のHossiiを登録できる
2. 管理者がスペース単位でマイHossii表示をONにできる
3. スペースHossiiと参加者のマイHossiiが同じ景色に存在する
4. マイHossiiに触れると、ニックネームと最近のログが見える
5. 最近の活動に応じて、表情や短い吹き出しが変わる
6. 多人数でも画面を重くしすぎず、全員の存在が表示される
7. 画像登録と将来のカスタム作成へ拡張できる



* マイHossiiは全スペース共通か、スペースごとに変えられるか⇨スペース管理設定で、マイHossiiモードon,ofを切り替えられるようにしたい

* マイHossii未登録者もデフォルト姿で表示するか
⇨いいえ、登録した人だけ

* 画面に参加者全員を出すか、最近動いた人だけ出すか
⇨全員出したい

* 「最近のログ」を直近1件とするか、一定期間の活動要約とするか
⇨直近３件くらい


主な確定内容は以下です。

user_profiles にマイHossii設定を保存
1アカウント1体、全スペース共通
未登録ユーザーとゲストは表示しない
スペース単位で my_hossii_enabled を設定
参加者取得は、必要情報だけを返すSecurity Definer RPC 1本
スペースHossiiは既存 HossiiLive を維持
マイHossiiは軽量な MyHossiiLayer＋MyHossiiAvatar
HossiiLive を人数分複製しない
最近のログは既存storeから直近3件を導出
マイHossii専用の投稿取得やRealtimeは追加しない
1〜5体は通常浮遊、6〜12体は軽量、13体以上は静止中心
characterImageUrl は、動きを止めずに待機画像だけ置き換える
ON/OFF設定は CharacterTab に配置
発行参加者も初回ログイン時に user_profiles を作成
Phase 1〜6の変更範囲、受入条件、テスト、ロールバックまで記載



## マイHossii表示・操作に関する追加確定仕様

### 1. 自分のマイHossiiの表示

ログイン中のユーザー本人のマイHossiiは、他のマイHossiiより少し分かりやすく表示する。

表示方法は、輪郭または淡い光による強調とする。

「あなた」という文字は常時表示せず、世界観を妨げない範囲で視覚的に判別できるようにする。

ゲスト閲覧時は、本人判定を行わない。

---

### 2. 活動状況によるサイズ変化

マイHossiiの基本サイズは共通とするが、最近活動したユーザーは少し大きく表示する。

サイズ変化は、ユーザーの優劣や評価を表すものではなく、最近動きがあったことを空間へ反映するための演出とする。

サイズ差は過度に大きくせず、次の範囲を目安とする。

* 通常状態：基準サイズ
* 最近活動あり：基準サイズの約1.05〜1.15倍
* 長期間活動なし：基準サイズを維持する

活動していないユーザーを小さくしたり、目立たなくしたりする表現は初期リリースでは行わない。

「最近活動した」の期間は、実装時に投稿頻度を確認して確定する。

初期候補は次のとおり。

* 24時間以内
* 3日以内
* 7日以内

---

### 3. 最近の投稿に連動した吹き出し

ユーザーが新しいログを投稿した際、そのユーザーのマイHossiiから一時的に吹き出しを表示する。

吹き出しには次のいずれかを表示する。

* 投稿本文の短い抜粋
* 投稿カテゴリや数値を用いた短い表現
* 感情や活動内容から導出した短い言葉

例：

* 「今日は3つ進めたよ」
* 「新しい気づきがあったみたい」
* 「次の一歩を考え中」
* 「新しいログを残しました」

吹き出しは一定時間後に自動で消える。

すべてのマイHossiiが同時に吹き出しを表示しないように、表示件数と表示時間を制御する。

ホバーまたはタップによる情報表示とは別の演出として扱う。

---

### 4. 退出・無効化されたユーザー

次のいずれかに該当したユーザーは、マイHossiiの表示対象から直ちに除外する。

* スペースニックネームが削除され、ほかの有効な参加経路も存在しない
* 発行参加者アカウントのstatusがrevoked等の無効状態になった
* アカウントが削除された
* マイHossii設定が解除された

過去の参加者として薄く残す機能は、初期リリースには含めない。

過去の投稿自体は、既存の投稿保存・表示仕様に従う。

---

### 5. マイHossiiの簡易ポップオーバー

マイHossiiをクリックまたはタップすると、Hossiiの近くに小さなポップオーバーを表示する。

表示内容：

* スペースで設定したニックネーム
* 直近3件の公開ログ
* 最終活動日時
* 「この人のログを見る」導線

ログ公開範囲は、スペース管理設定に従う。

#### 公開範囲：全員

ゲストを含む全閲覧者に、直近3件とログへの導線を表示する。

#### 公開範囲：ログインユーザーのみ

ゲストにはニックネームだけを表示する。

ログインユーザーには、直近3件、最終活動日時、ログへの導線を表示する。

#### 公開範囲：誰にも表示しない

すべての閲覧者に、マイHossiiとニックネームのみを表示する。

直近ログ、最終活動日時、ログへの導線は表示しない。

---

### 6. 「この人のログを見る」導線

初期リリースでは、既存の投稿者別ログ表示機能を流用する。

ポップオーバー内の「この人のログを見る」を押すと、対象ユーザーの投稿者別タイムラインを表示する。

流用候補：

* `groupHossiisByAuthor`
* `AuthorTimelineModal`
* 既存のbyAuthor表示モード

対象は現在のスペース内の公開ログとする。

別スペースのログは表示しない。

初期リリースでは、公開プロフィール専用ページは新設しない。

---

### 7. 将来の公開プロフィール・ログページ

将来拡張として、ユーザーごとの公開ページを追加できる構造とする。

仮のページ構成：

```text
/users/:userId
```

または、スペース内の表示に限定する場合：

```text
/spaces/:spaceId/users/:userId
```

表示候補：

* マイHossii
* ニックネーム
* 自己紹介
* 最近のログ
* 投稿履歴
* 活動カテゴリ
* 継続状況
* 感情や気づきの変化
* 参加している公開スペース
* 本人が公開を許可したプロフィール情報

公開範囲はユーザー本人およびスペース管理者が制御できる仕様を別途検討する。

初期リリースでは、既存の投稿者別タイムラインをプロフィール・ログページの代替として使用する。

---

### 8. Phaseへの反映

#### Phase 2｜スペース表示

* 自分のマイHossiiを輪郭または光で強調
* 最近活動したHossiiのサイズ変更に対応できるpropsを用意
* 管理者が選択した動作モードを反映
* 投稿量に応じて動きを自動調整するモードを初期値とする

#### Phase 3｜プロフィール・最近のログ

* ポップオーバーにニックネームを表示
* 直近3件を表示
* 最終活動日時を表示
* 「この人のログを見る」導線を追加
* 既存`AuthorTimelineModal`等を流用
* スペース管理者が設定したログ公開範囲を適用

#### Phase 4｜表情・吹き出し

* 新規投稿時に一時的な吹き出しを表示
* 最近活動したユーザーのHossiiを少し大きく表示
* 同時吹き出し数と表示時間を制御

#### 将来Phase｜公開プロフィール・ログページ

* ユーザー別の公開ページ
* 自己紹介や公開プロフィール
* 複数スペースを横断する活動表示
* ユーザー本人による公開範囲設定

---

## 35. 実装記録（2026-07-07）

### 35-1. ブランチ

```text
feat/my-hossii
```

### 35-2. DBカラム（実名）

| テーブル | カラム | 用途 |
|---|---|---|
| user_profiles | hossii_source_type | preset または upload |
| user_profiles | hossii_preset_key | プリセット key |
| user_profiles | hossii_image_path | Storage path |
| user_profiles | hossii_updated_at | 最終更新 |
| spaces | my_hossii_enabled | 表示 ON/OFF、デフォルト false |
| spaces | my_hossii_motion_mode | free / anchored / auto、デフォルト auto |
| spaces | my_hossii_log_visibility | public / authenticated / hidden、デフォルト public |

### 35-3. RPC

```text
list_my_hossii_participants(p_space_id text)
```

migration: `20260707131000_list_my_hossii_participants_rpc.sql`

実行権限: anon, authenticated

### 35-4. 主要コンポーネント

| コンポーネント | ファイル |
|---|---|
| 設定 UI | MyHossiiSettingsSection.tsx |
| スペースレイヤー | MyHossiiLayer.tsx |
| 軽量 Avatar | MyHossiiAvatar.tsx |
| ポップオーバー | MyHossiiPopover.tsx |
| 初回案内 | MyHossiiPrompt.tsx |
| 管理者設定 | CharacterTab.tsx |
| スペース Hossii 画像差し替え | HossiiLive idleImageOverride |

### 35-5. 主要 util / hook

| 名前 | ファイル |
|---|---|
| fetchMyHossiiParticipants | myHossiiParticipantsApi.ts |
| useMyHossiiParticipants | useMyHossiiParticipants.ts |
| computeMyHossiiPosition | myHossiiPosition.ts |
| resolveMyHossiiAnimationTier | myHossiiAnimationLevel.ts |
| resolveMyHossiiImage | resolveMyHossiiImage.ts |
| deriveMyHossiiActivity | myHossiiActivity.ts |
| deriveMyHossiiDisplayState | myHossiiExpression.ts |
| buildMyHossiiSpeechBubbleText | myHossiiSpeechBubble.ts |
| uploadMyHossiiAvatar | imageStorageApi.ts |

### 35-6. 人数閾値（実装値）

| 人数 | tier |
|---:|---|
| 1〜5 | full |
| 6〜12 | light |
| 13以上 | none |

### 35-7. 最近活動の期間

```text
MY_HOSSII_RECENT_ACTIVITY_MS = 3日
```

### 35-8. 吹き出し制御（実装値）

| 項目 | 値 |
|---|---|
| 同時最大 | 3件 |
| 表示時間 | 6秒 |
| 文字数目安 | 20〜40文字 |

### 35-9. Storage path

```text
avatars/{auth_uid}/my-hossii.webp
```

バケット: hossii-images

### 35-10. 初回案内 dismiss キー

```text
hossii.myHossiiPromptDismissed.{userId}.{spaceId}
```

### 35-11. Phase 実装状況

| Phase | 状態 |
|---|---|
| Phase 1 プリセット登録 | 実装済み |
| Phase 2 スペース表示 | 実装済み |
| Phase 3 ポップオーバー・直近ログ | 実装済み |
| Phase 4 表情・吹き出し連動 | 実装済み |
| Phase 5 画像アップロード | 実装済み |
| Phase 6 カスタム作成 | 未実装・仕様案のみ |

### 35-12. 仕様との既知差分

- OAuth 一般ログイン時の user_profiles 自動作成は、発行参加者と保存時 ensure のみ。103 §13-2 の全ログイン時 ensure は未対応
- 追加タブ・ペインへのマイHossii表示は未対応。メイン HOME のみ
- PC ホバーでの簡易プレビューは未実装。タップでポップオーバー表示
- ブラウザ手動受入は開発環境で未実施項目あり
