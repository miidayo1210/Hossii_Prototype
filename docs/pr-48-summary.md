## 概要

コードベース全体レビュー（#48）に基づく一次改善。
セキュリティ・パフォーマンス・構造の3点について優先度の高い箇所を修正した。

---

## 主な変更内容

### セキュリティ
- `featureFlagsApi`: Supabase 取得成功時は localStorage を参照しない実装に変更（クライアントからの機能フラグ改ざんを困難化）
- `imageStorageApi`: アップロード前に MIME バリデーションを追加（JPEG/PNG/WebP/GIF のみ許可）
- `spacesApi`: デバッグ用 `console.log`（ユーザーID出力）を削除

### パフォーマンス
- `featureFlagsApi`: 2 つの Supabase クエリを直列 → `Promise.all` 並列実行に変更（RTT 50ms 仮定時、約 50ms 短縮が期待できる）
- `DisplayPrefsContext` を新規作成し、表示設定を HossiiStore から分離。投稿追加時に `HossiiToggle`・`DisplayScaleToggle` 等が再描画されない構成になった（コード解析上）

### 構造
- `AuthContext`: value・各認証関数を `useMemo` / `useCallback` でメモ化
- `AuthContext`: `getSession` + `onAuthStateChange` の競合を解消し、初期化フローを単一パスに統一
- `SpaceScreen`: `useSpaceSettings` / `useNeighborSpace` を切り出し（815行 → 738行）
- `HossiiStoreProvider`: 表示設定関連の state・action を分離（1208行 → 1013行）

---

## 変更ファイル（主要）

- `src/core/contexts/AuthContext.tsx`
- `src/core/contexts/DisplayPrefsContext.tsx`（新規）
- `src/core/utils/featureFlagsApi.ts`
- `src/core/utils/imageStorageApi.ts`
- `src/core/utils/spacesApi.ts`
- `src/core/hooks/HossiiStoreProvider.tsx`
- `src/components/SpaceScreen/SpaceScreen.tsx`
- `src/components/SpaceScreen/useSpaceSettings.ts`（新規）
- `src/components/SpaceScreen/useNeighborSpace.ts`（新規）

---

## 動作確認

- `npm run lint`: ✅ 0 errors
- `npm run build`: ✅ pass
- ゲスト入場 / ログイン / 投稿 / 表示設定切替 / 隣人ワープ: ✅ 主要導線で問題なし

---

## 残課題（このPRでは対応しない）

- `App.tsx` の `useHossiiStore()` broad subscribe 問題（B-8）
- バンドルサイズ最適化（コードスプリット）
- React Profiler による数値実測（パフォーマンス改善の定量確認が未完）
- Supabase RLS 設定の確認（フロント変更とは独立）
- Priority 3 の残課題（B-10〜B-12）

---

## 注意点

- パフォーマンス改善はコード解析・体感確認ベースの評価であり、Profiler 実測は未実施
- featureFlags のフラグ改ざん対策はフロント実装上の変更のみ。RLS による認可制御とは独立している
- `App.tsx` の broad subscribe 問題は未対応のため、認証状態変更時に全画面が再描画される状況は継続している
