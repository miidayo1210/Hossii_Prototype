# 116 アカウント画面UIナビゲーション — Questログ

> 正本: `docs/仕様書/現在の仕様/116_アカウント画面UIナビゲーション.md`
> 作業ブランチ: `feat/account-ui-navigation`

---

## Quest Q1 — T1: screenParam による区分解決

| 項目 | 内容 |
|------|------|
| **目的** | `AccountScreen` が `useRouter` の既存 `screenParam` で4区分を解決する（`useRouter` 変更なし） |
| **変更ファイル** | `accountSection.ts`, `accountSection.test.ts`, `AccountScreen.tsx`, `AccountScreen.test.tsx`, `AccountScreen.module.css` |
| **実装内容** | `resolveAccountSection` ユーティリティ追加。`screenParam` から home/profile/spaces/my-hossii を解決し、区分ごとにコンテンツを切替 |
| **テスト結果** | 12件 PASS / lint PASS / build PASS |
| **commit** | d3d7ee2 |
| **状態** | DONE |
| **次のQuest** | Q2 |

---

## Quest Q2 — T2: 区分ナビ（上部セグメントタブ）

| 項目 | 内容 |
|------|------|
| **目的** | 暫定の上部セグメントタブで4区分を切替し `navigate('account', param)` する |
| **変更ファイル** | `AccountSectionNav.tsx`, `AccountSectionNav.module.css`, `AccountSectionNav.test.tsx`, `AccountScreen.tsx` |
| **実装内容** | 4タブのセグメントナビ追加。クリックで `navigate('account', param)` |
| **テスト結果** | 7件 PASS / lint PASS / build PASS |
| **commit** | 3a50fc3 |
| **状態** | DONE |
| **次のQuest** | Q3 |

---

## Quest Q3 — T3: ホーム区分

| 項目 | 内容 |
|------|------|
| **目的** | 挨拶・状態要約・入口カードのみのホーム区分を新規実装 |
| **変更ファイル** | `AccountHomeSection.tsx`, `AccountHomeSection.module.css`, `accountCommunitySummary.ts`, 関連テスト, `AccountScreen.tsx` |
| **実装内容** | ホームに要約3行（表示名/ログイン状態/コミュニティ）と入口カード3件。フォーム・一覧なし |
| **テスト結果** | 29件（AccountScreen配下）PASS / lint PASS / build PASS |
| **commit** | 3fa6d60 |
| **状態** | DONE |
| **次のQuest** | Q4 |

---

## Quest Q4 — T4: プロフィール区分移管

| 項目 | 内容 |
|------|------|
| **目的** | アカウント情報・ニックネーム2種・認証操作をプロフィール区分へ移管（挙動変更なし） |
| **変更ファイル** | `AccountProfileSection.tsx`, `AccountProfileSection.test.tsx`, `AccountScreen.tsx` |
| **実装内容** | 既存セクションを `AccountProfileSection` に抽出。保存・ログアウト・ゲスト導線を維持 |
| **テスト結果** | 32件 PASS / lint PASS / build PASS |
| **commit** | edc6bfb |
| **状態** | DONE |
| **次のQuest** | Q5 |

---

## Quest Q5 — T5: 参加先区分移管

| 項目 | 内容 |
|------|------|
| **目的** | CommunitySwitcher / JoinedSpacesSection / CommunityPersonalSpacesSection を参加先区分へ移管 |
| **変更ファイル** | `AccountSpacesSection.tsx`, `AccountSpacesSection.test.tsx`, `AccountScreen.tsx` |
| **実装内容** | 既存3ブロックを `AccountSpacesSection` に集約。未ログイン時の案内は子コンポーネント現行維持 |
| **テスト結果** | 7件 PASS / lint PASS / build PASS |
| **commit** | 14976b7 |
| **状態** | DONE |
| **次のQuest** | Q6 |

---

## Quest Q6 — T6: マイHossii区分移管

| 項目 | 内容 |
|------|------|
| **目的** | `MyHossiiSettingsSection` をマイHossii区分へ移管（挙動変更なし） |
| **変更ファイル** | `AccountMyHossiiSection.tsx`, `AccountMyHossiiSection.test.tsx`, `AccountScreen.tsx` |
| **実装内容** | 既存 Props 連携を維持したラッパー `AccountMyHossiiSection` を追加 |
| **テスト結果** | 5件 PASS / lint PASS / build PASS |
| **commit** | 39deb29 |
| **状態** | DONE |
| **次のQuest** | Q7 |

---

## Quest Q7 — T7: CSS整理

| 項目 | 内容 |
|------|------|
| **目的** | 区分レイアウト向けに `AccountScreen.module.css` を最低限整理 |
| **変更ファイル** | `AccountScreen.module.css`, `AccountSectionNav.module.css`, Questログ |
| **実装内容** | 未使用スタイル削除、border-radius 統一（1rem）、ヘッダー/ナビ/コンテンツ余白調整 |
| **テスト結果** | npm test 836件 PASS / lint PASS / build PASS |
| **commit** | b2857ce |
| **状態** | DONE |
| **次のQuest** | Q8 — T8（Phase 2） |

---

## Quest Q8 — T8: ホーム要約データ連携

| 項目 | 内容 |
|------|------|
| **目的** | 入口カードに件数・登録状態バッジを付与（上部要約との重複なし） |
| **変更ファイル** | `useAccountHomeEntryBadges.ts`, `AccountHomeSection.tsx`, 関連テスト |
| **実装内容** | 参加先カードに参加スペース件数、マイHossiiカードに登録状態バッジ。既存 API を再利用 |
| **テスト結果** | 6件 PASS / lint PASS / build PASS |
| **commit** | a14cd4f |
| **状態** | DONE |
| **次のQuest** | Q9 |

---

## Quest Q9 — T9: ホーム要約のローディング表示

| 項目 | 内容 |
|------|------|
| **目的** | ホーム上部要約のコミュニティ行に読み込み状態を反映（区分内の既存 loading/error は子コンポーネント維持） |
| **変更ファイル** | `accountCommunitySummary.ts`, `AccountScreen.tsx`, テスト |
| **実装内容** | `resolveCommunitySummaryLabel` で membership loading 時に「読み込み中」を表示 |
| **テスト結果** | 6件 PASS / lint PASS / build PASS |
| **commit** | （本コミット） |
| **状態** | DONE |
| **次のQuest** | — |

---

## Quest Q10 — T10: デザイン調整

| 項目 | 内容 |
|------|------|
| **目的** | 丸み・アクセント・カード平坦化（仕様3章） |
| **状態** | SKIPPED |
| **理由** | Q7 で Phase 1 最低限のスタイル整理を実施済み。Phase 2 専用の追加デザイン調整はスコープ外として保留 |

---

## BLOCKED / SKIPPED

| Quest | 理由 |
|-------|------|
| T10 デザイン調整（Phase 2 追加分） | Q7 で Phase 1 分を実施済み。追加 polish は別途判断 |
| T11 区分ナビ最終 UI | 未確定 U1 |
| T12 ニックネーム統合 | 仕様書で変更禁止 |
| T13 マイHossii対象スペース | 仕様書で変更禁止 |
| T14 認証導線整理 | 未確定 U4 |
| T15 既存テスト追随 | Phase 3。CommunityPersonalSpacesSection 等は現行テスト PASS を確認済み |
