# 117 Hossiiガイド吹き出し — Quest ログ

> 正本: `docs/仕様書/現在の仕様/117_Hossiiガイド吹き出し.md`  
> 作業ブランチ: `feat/hossii-guide-bubble`  
> 基準ブランチ: `origin/docs/account-ui-navigation`

## Phase 1 Quest 一覧（計画）

| Quest | 内容 | 依存 |
|-------|------|------|
| Q1 | パッケージ定義・型・定数検証テスト | — |
| Q2 | `resolveGuideMessagePool` / ランダム選択 / テキスト整形 / バリデーション | Q1 |
| Q3 | migration: `space_settings.hossii_guide` JSONB（ファイル作成のみ） | DB 調査 |
| Q4 | `spaceSettingsApi` / `settingsStorage` 読み書き | Q1, Q3 |
| Q5 | `CharacterTab` 管理 UI（ON/OFF・パッケージ・プレビュー） | Q1, Q2, Q4 |
| Q6 | `HossiiLive` `.guideBubble` + CSS + 閉じる UI | Q2 |
| Q7 | `SpaceScreen` 表示タイミング・props・メモリ保持 | Q2, Q4, Q6 |
| Q8 | idle 抑止・B2 暫定（投稿反応時 guide 非表示） | Q6, Q7 |
| Q9 | スマホはみ出し CSS（14.2） | Q6 |

## DB 調査メモ

- `space_settings` は既に `post_fields` 等の JSONB 列を持つ。`hossii_guide` JSONB 追加は既存パターンと整合。
- 保存経路: `spaceSettingsApi.ts` の parse/upsert、`settingsStorage.ts` の localStorage。
- migration は append-only。dev/prod DB への push は行わない。

## 仕様整理

### 確定（Phase 1 実装対象）

- スペース単位 ON/OFF、`package` モードのみ有効
- 8 パッケージから 1 つ選択、ランダム 1 件表示
- `HossiiLive` の `.guideBubble`、idle/brain 抑止
- 初回表示（1〜2 秒遅延）、閉じたら同一 SpaceScreen 生存中は再表示しない
- `CharacterTab`「Hossiiのひとこと」、管理プレビュー
- 不正 packageKey は非表示（画面を壊さない）

### 未確定（Phase 1 対象外 / 暫定）

- **B1**: タップ再表示 → 実装しない
- **B2**: 投稿反応 `.bubble` 優先 → 5.7 暫定仮定で Q8 実装

---

## Q1 — パッケージ定義・型

- **目的:** 8 パッケージ定義、`HossiiGuideSettings` 型、定数検証テスト
- **変更ファイル:**
  - `src/core/assets/hossiiGuidePackages.ts`
  - `src/core/assets/hossiiGuidePackages.test.ts`
  - `src/core/types/settings.ts`
  - `docs/実装ログ/117_hossii_guide_quest_log.md`
- **実装内容:** 仕様 10.3 の 8 パッケージ（各 5 件）をコード定義。`resolvePackageMessages` / `isKnownHossiiGuidePackageKey` を追加。型を `settings.ts` に追加。
- **テスト結果:** `npm test src/core/assets/hossiiGuidePackages.test.ts` — 6 passed。lint/build OK。
- **commit:** `5b3ce8c`
- **状態:** DONE
- **次の Quest:** Q2

---

## Q2 — ランダム選択・バリデーション・テキスト整形

- **目的:** `buildGuideMessagePool` / `pickRandomGuideMessage` / 保存バリデーション / 表示テキスト整形
- **変更ファイル:**
  - `src/core/utils/hossiiGuide.ts`
  - `src/core/utils/hossiiGuide.test.ts`
  - `docs/実装ログ/117_hossii_guide_quest_log.md`
- **実装内容:** Phase 1 向けプール構築（package のみ）、ランダム 1 件選択、管理保存バリデーション、`formatGuideMessageText`、`GUIDE_BUBBLE_INITIAL_DELAY_MS` 定数。
- **テスト結果:** `npm test src/core/utils/hossiiGuide.test.ts` — 20 passed。lint/build OK。
- **commit:** （このコミット）
- **状態:** DONE
- **次の Quest:** Q3

---