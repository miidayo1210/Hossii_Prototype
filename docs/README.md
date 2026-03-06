# Hossii ドキュメント

---

## 構成

```
docs/
├── README.md                    ← このファイル（全体マップ）
│
├── core/                        ← Hossii基盤（全スペース共通）
│   └── core-concepts.md         ← 用語定義・共通データ構造・4レイヤーモデル
│
├── spaces/                      ← スペースタイプ仕様書（汎用・再利用可能な設計）
│   ├── _space-template.md       ← 新スペースタイプ追加時のテンプレート
│   ├── workshop-space.md        ← ワークショップスペース（Priority 1）
│   ├── plaza-space.md           ← 広場スペース（Priority 2）
│   └── introspection-space.md   ← 内省スペース（Priority 3）
│
├── projects/                    ← 案件仕様書（具体的なプロジェクト・差分のみ記載）
│   ├── _project-template.md     ← 新案件追加時のテンプレート
│   ├── tsukubasan-nisshoan.md   ← 筑波山（日升庵・人時）
│   ├── nishiike-valley-screening.md ← ニシイケバレイ 映画鑑賞会
│   ├── shimotsu-education.md    ← 下妻PJ（教育PJ）
│   ├── sekisho-hr.md            ← 関彰商事 人事領域
│   ├── resonac-hr.md            ← レゾナック 人事領域
│   └── inspired-lab.md          ← Inspired Lab
│
├── space-product-vision.md      ← スペースの商品思想・セレンディピティコンセプト
├── feature-flags.md             ← Feature Flag実装仕様
├── dev-workflow.md              ← 開発ワークフロー
├── github-branch-protection.md  ← ブランチ保護設定
│
└── 仕様書/現在の仕様/             ← 機能別実装仕様（Core / Implementation）
    ├── 00_仕様概要.md             [Core] 機能全体の概要
    ├── 01_投稿（Hossii投稿).md    [Core] 投稿データ型・送信フロー
    ├── 02_匿名利用機能.md          [Core] ゲスト・ログイン参加者の識別
    ├── 03_スペースURL機能.md       [Core] URL設計・アクセスフロー
    ├── 04_データ保存機能.md        [Core] Supabaseテーブル・RLS・Storage
    ├── 05_管理者ログイン画面.md     [Core] 管理者認証
    ├── 06_ナビゲーション・UI構成.md [Core] 画面遷移・ナビゲーション構造
    ├── 07_投稿画面UIUX.md         [Implementation] 投稿画面のUI詳細
    ├── 08_スペース（HOME）の仕様書.md [Implementation] スペースビューのUI詳細
    ├── 09_スペース管理画面UI仕様書.md [Implementation] 管理画面のUI詳細
    ├── 10_ログインユーザー管理設計.md  [Core] ユーザー管理・認証フロー
    ├── 11_レスポンシブ設計.md       [Core] レスポンシブ対応方針
    ├── 12_画像投稿.md              [Implementation] 画像アップロードUI・処理
    ├── 13_スペースUIUX.md         [Implementation] スペース表示のUX詳細
    ├── 14_スペース背景画像登録機能.md [Implementation] 背景設定UI
    ├── 15_スペース名変更機能.md     [Implementation] スペース名編集UI
    ├── 16_ゲスト入室フロー.md       [Core] ゲスト参加フロー・GuestEntryScreen
    ├── 17_投稿写真のローカル保存.md  [未着手]
    ├── 18_function_投稿へのいいね、コメント機能.md [未着手]
    ├── 19_スライドショー画面の追加.md [未着手 / spaces/で定義]
    └── 20_feat_内省スペース.md      [未着手 / spaces/で定義]
```

---

## 仕様書を読む順番

### 初めて触れる人向け

1. [space-product-vision.md](./space-product-vision.md) — Hossiiが何を目指すか
2. [core/core-concepts.md](./core/core-concepts.md) — 用語と共通構造
3. [仕様書/現在の仕様/00_仕様概要.md](./仕様書/現在の仕様/00_仕様概要.md) — 現在実装されている機能の全体像

### 新しいスペースタイプを追加したい人向け

1. [space-product-vision.md](./space-product-vision.md) — スペースの設計思想を確認
2. [spaces/_space-template.md](./spaces/_space-template.md) — テンプレートをコピー
3. 既存のスペース仕様書（workshop-space.md など）を参考に記入

### 新しい案件（プロジェクト）を追加したい人向け

1. [spaces/](./spaces/) の中から使うスペースタイプを決める
2. [projects/_project-template.md](./projects/_project-template.md) をコピー
3. 既存の案件仕様書（inspired-lab.md など）を参考に差分のみ記入
4. 案件終了後、昇格させる差分を対応するスペースタイプに書き戻す

### 機能を実装したい人向け

1. [core/core-concepts.md](./core/core-concepts.md) — 用語・型を確認
2. [feature-flags.md](./feature-flags.md) — Feature Flagの追加手順
3. [仕様書/現在の仕様/](./仕様書/現在の仕様/) — 該当機能の仕様書

---

## 案件とスペースタイプの関係

```
スペースタイプ（汎用設計）         案件（具体的なプロジェクト）
──────────────────────────      ─────────────────────────────
workshop-space.md            →  shimotsu-education.md
                             →  nishiike-valley-screening.md
                             →  sekisho-hr.md（説明会部分）

plaza-space.md               →  tsukubasan-nisshoan.md
                             →  inspired-lab.md
                             →  resonac-hr.md
                             →  sekisho-hr.md（コミュニティ部分）

introspection-space.md       →  （個人利用・将来の案件）
```

案件で同じ差分が2回以上出てきたら → スペースタイプに昇格させる。

---

## 分類について

各仕様書には以下の分類タグを付けている。

| タグ | 意味 |
|------|------|
| `[Core]` | 全スペースに共通する基盤仕様 |
| `[Implementation]` | 実装詳細（UIの細部・コンポーネント構成など） |
| `[Space固有]` | 特定スペースのみに関係する仕様 |
| `[未着手]` | まだ仕様書として書かれていない機能 |
