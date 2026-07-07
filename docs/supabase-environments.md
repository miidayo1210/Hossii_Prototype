# Supabase 環境分離

Hossii は **Production** と **Development** の 2 つの Supabase プロジェクトで運用します。

公開 Project ref は `config/supabase-environments.json` で管理します。anon key・service role key・DB パスワードは Git に含めません。

## 環境一覧

| 環境 | Project ref | Dashboard 名 | 用途 |
|------|-------------|--------------|------|
| Production | `wzyoddyvfjkagqpnjejo` | Hossii Production（旧: Hossii test DB） | Vercel Production、本番データ |
| Development | `uodaubhlcvvqlgsdxcdf` | Hossii Development | localhost、Vercel Preview、migration 検証、テストデータ |

## Vercel との対応

| Vercel 環境 | `VITE_APP_ENV` | Supabase |
|-------------|----------------|----------|
| Production | `production` | Production |
| Preview | `development` | Development |
| Development（任意） | `development` | Development |

**旧方針「Vercel Preview = Production DB」は廃止しました。** Preview は Development DB のみを使用します。

## localhost 設定

`.env.local`（Git 管理外）:

```env
VITE_APP_ENV=development
VITE_EXPECTED_SUPABASE_REF=uodaubhlcvvqlgsdxcdf
VITE_SUPABASE_URL=https://uodaubhlcvvqlgsdxcdf.supabase.co
VITE_SUPABASE_ANON_KEY=<Development anon key>
```

Production の URL / anon key をローカルに保存しないでください。

## CLI リンク

Development 作業前:

```bash
supabase link --project-ref uodaubhlcvvqlgsdxcdf
cat supabase/.temp/project-ref   # uodaubhlcvvqlgsdxcdf であること
```

Production 作業が必要な場合のみ、意図的に Production へリンクしてください。

## migration 適用

**必ず npm scripts を使ってください。** 生の `supabase db push` は誤接続防止のため非推奨です。

```bash
# リンク先確認
npm run db:target -- development

# Development へ適用（dry-run → push）
npm run db:push:dev

# Production へ適用（明示確認必須）
CONFIRM_PRODUCTION=wzyoddyvfjkagqpnjejo npm run db:push:prod
```

## seed（Development のみ）

```bash
npm run db:seed:dev
```

- `scripts/seed-development.mjs` が Development ref のみ許可
- Production ref がリンクされている場合は **即終了**
- Auth ユーザー作成後に `supabase/seed/development.sql` を適用

テスト用メール（例）:

- `dev-super-admin@example.test`
- `dev-community-admin@example.test`
- `dev-user-a@example.test`
- `dev-user-b@example.test`
- `dev-user-same-name@example.test`

パスワードは `.supabase-dev-auth-password.local` に保存（Git 管理外）。

## フロントの環境ガード

`src/core/supabaseEnvironment.ts` が次を検証します。

- `VITE_APP_ENV`
- `VITE_EXPECTED_SUPABASE_REF`
- `VITE_SUPABASE_URL` から取得した実 Project ref

不一致時は設定エラー画面を表示し、DB 書き込みを開始しません。Supabase 未設定時は従来どおり mock モードを維持します。

Development 環境のみ画面に `DEV` バナーを表示します。

## バックアップ・PITR

現状（Production）:

- **WALG: 有効**
- **PITR: 無効**（契約変更は別タスク）

運用ルール:

1. Production migration 前に Dashboard でバックアップ日時を確認
2. Production migration 前に主要テーブル件数をスナップショット
3. `db:push:prod` は `CONFIRM_PRODUCTION` 必須
4. 障害時は **フロントの切り戻しを最優先**、その後 DB 判断

## 緊急時対応

1. Vercel Production のデプロイを前バージョンへロールバック
2. 影響範囲（投稿・Storage・Auth）を Development で再現確認
3. Production DB 操作は `CONFIRM_PRODUCTION` 付き手順のみ

## 禁止事項

- Production データ / Auth / Storage の Development へのコピー
- Production URL / anon key の Development への設定
- Production 向け seed 実行
- 秘密鍵の Git コミット
- 確認なしの `supabase db push`（Production リンク時）

## 手動作業メモ

- Vercel Preview 環境変数を Development に更新後、Preview を再デプロイ
- Production Dashboard 名を `Hossii Production` に変更（分離完了後）
- PITR プラン判断は別タスク
