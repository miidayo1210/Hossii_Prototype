# 59 コード上の Potential Issues

> **分類:** `[Core]` 技術負債・既知の挙動  
> **関連:** Feature Flags、`PostScreen`、`useFeatureFlags`（`src/core/hooks/useFeatureFlags.ts`）

> 最終更新: 2026-04-05

---

## この文書の目的

コードレビューで挙がった **潜在的な不整合・将来のバグ要因** を一覧化する。仕様として許容するか、あとで修正するかの判断材料用であり、すべてがバグではない。

---

## 優先度: 高

### 1. フラグキャッシュ無効化後も、マウント中の UI が古いフラグのまま

**現象:** `FeatureFlagsTab` で保存成功後に `invalidateFeatureFlagsCache(spaceId)` が呼ばれるが、`useFeatureFlags` の `useEffect` は **`spaceId` が変わらない限り再実行されない**。そのため、同じスペースの投稿画面などがマウントされたままだと、**state が更新されず**、管理画面で OFF にした直後も投稿画面ではグリッドが表示されたまま、といったずれが起こり得る。

**関連:** `src/core/hooks/useFeatureFlags.ts`、`src/components/SpaceSettingsScreen/FeatureFlagsTab.tsx`

**改善の方向性:** キャッシュ無効化をフックが検知して再フェッチする、同一 `spaceId` でも `invalidate` 後に `setFlags` する、`BroadcastChannel` やカスタムイベントで購読者に再取得を促す、など。

---

### 2. スペース切替時、キャッシュヒットだとフラグ state が前スペースのまま残る

**現象:** `useFeatureFlags` の `useEffect` 内で、`getCached(spaceId)` が真のとき **再フェッチを省略して `return` しているだけ**で、`setFlags` していない。スペース A から B に切り替え、かつ B がキャッシュ済みの場合、**表示上の `flags` が B に同期されず A のまま**になる可能性がある。

**関連:** `src/core/hooks/useFeatureFlags.ts` 内の `if (getCached(spaceId)) return;`

**改善の方向性:** キャッシュがある場合でも `setFlags` で現在の `spaceId` に対応するフラグを state に反映する。

---

## 優先度: 中

### 3. パネルモードで `initialPosition` が無い場合のデータ不整合リスク

**現象:** `PostScreen` の `handleSubmit` で、`panelMode` が真なら `isPositionFixed` を常に真にしつつ、`initialPosition` が無いと `positionX` / `positionY` は `undefined` のまま送られる可能性がある。現状の呼び出し元（クイック投稿）では `quickPostPos` があり実害は出にくいが、**将来 `panelMode` だけ付けて `initialPosition` を省略する呼び出し**が増えると不整合の温床になる。

**関連:** `src/components/PostScreen/PostScreen.tsx` の `addHossii` への引数組み立て

**改善の方向性:** `initialPosition` が定義されているときだけパネルで固定座標扱いにする、型で必須にする、など。

---

## 優先度: 低

### 4. スペース変更時に `selectedArea` がリセットされない

**現象:** `position_selector` が ON のままアクティブスペースだけ変えた場合、位置グリッドの選択インデックス `selectedArea` はそのまま残る。別スペースなのに前スペースで選んだエリアがハイライトされたままになる。**仕様として許容するなら問題にならない**が、紛らわしければ `activeSpaceId` 変化時に `null` に戻すとよい。

**関連:** `src/components/PostScreen/PostScreen.tsx` の `selectedArea` state

---

### 5. 運用・データベース

- **`feature_flags` テーブルに `position_selector` 行が無い**場合でも、`castToFeatureFlags` で `false` 補完されるため致命的ではない。ダッシュボードでデフォルトを明示管理したい場合は行の追加を検討する。
- **`likes_enabled` など**は API 型にはあるが `FeatureFlagsTab` の一覧に無いフラグがある。フラグが増えるほど、管理 UI と API の差分に注意する。

---

## 補足: 今回の position_selector 実装について

グリッド表示条件、`positionGridActive`、フラグ OFF 時の `selectedArea` クリア用 `useEffect` は、意図どおり読める。懸念の中心は **`useFeatureFlags` のキャッシュと state の同期**であり、特定機能に限らずアプリ全体のフラグ一貫性に関わる。

---

## 対応計画（実装方針）

一覧の **1・2** は [`useFeatureFlags.ts`](../../../src/core/hooks/useFeatureFlags.ts) でまとめて扱うのがよい。

| 項目 | 方針 |
|------|------|
| **1. invalidate 後の UI** | `invalidateFeatureFlagsCache` 呼び出し時に、購読中の `useFeatureFlags` が再評価される仕組みを追加する（例: モジュールスコープの無効化バージョンを `useSyncExternalStore` 等で購読、またはリスナー通知）。キャッシュ削除後は同一 `spaceId` でも再フェッチし `setFlags` する。 |
| **2. スペース切替** | `spaceId` が変わるたび、TTL 内キャッシュがあっても **先に `setFlags` で現在スペースのフラグへ同期**してから、必要なら省略フェッチに入る（`getCached` のみで early return しない）。初期 `useState` はマウント時のみなので、effect 側での同期が重要。 |
| **3. パネルと座標** | `addHossii` の `isPositionFixed` を **`areaPos` が決まったときだけ真**（例: `!!areaPos` と同等の意味）に揃え、パネルかつ `initialPosition` なしはランダム扱いと一致させる。 |
| **4. selectedArea** | `activeSpaceId` 変化時に `setSelectedArea(null)` する `useEffect` を追加（既存のフラグ OFF 時クリアと整理可能なら一本化）。 |

**変更ファイルの想定:** 上記 1・2 は `useFeatureFlags.ts`、3・4 は `PostScreen.tsx`。

**検証:** `npm run lint` / `npm run build`、および「設定でフラグ保存 → 同一タブの投稿画面が追従するか」「スペース A/B 切替でフラグ表示が即一致するか」を手動確認。

---

## 対応時のリスク・注意点

| 種別 | 内容 |
|------|------|
| **ネットワーク** | invalidate 後に再フェッチが増える。TTL 内の省略取得と両立させる設計にし、**不要な連続リクエスト**（競合時の二重 fetch）に注意。`AbortController` の既存パターンを維持する。 |
| **レース** | スペースを素早く切り替えたとき、古い `spaceId` の fetch 完了が後から `setFlags` しないよう、**abort または「応答時に spaceId が一致するか」**のガードを崩さない。 |
| **挙動変更（3）** | 現状ほぼ発生しない「パネル + 座標なし」経路を、意図的に **固定フラグ false・ランダム配置**に寄せる。将来その組み合わせを「中央固定」にしたい場合は、呼び出し側で `initialPosition` を必ず渡すなど仕様を明確にする。 |
| **テスト** | 自動テストが薄い場合、回帰は手動確認頼みになりやすい。上記検証項目を PR / リリース前チェックに含めるとよい。 |
| **範囲外** | 項目 5（DB 行の有無・管理 UI と API の差分）はコード修正の対象外になりやすく、**運用・ドキュメント**で追う。 |

リスクはいずれも **中程度以下** で、設計どおりに実装すれば致命傷になりにくい。最も影響範囲が広いのは **1・2（`useFeatureFlags`）** のため、そこだけでも小さな PR に分けるとレビューしやすい。
