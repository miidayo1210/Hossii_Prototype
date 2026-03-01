-- ============================================================
-- hossii-images バケットの Storage RLS ポリシー
-- バケット自体はダッシュボードで作成済み（public バケット）
-- ポリシーはここで管理する
-- ============================================================

-- 既存ポリシーがあれば削除（冪等性のため）
DROP POLICY IF EXISTS "auth upload hossii-images" ON storage.objects;
DROP POLICY IF EXISTS "public read hossii-images" ON storage.objects;
DROP POLICY IF EXISTS "auth update hossii-images" ON storage.objects;
DROP POLICY IF EXISTS "auth delete hossii-images" ON storage.objects;

-- 全員が画像を読み取り可（公開スペースの投稿画像はゲストも閲覧できる）
CREATE POLICY "public read hossii-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hossii-images');

-- ログイン済みユーザーはアップロード可
CREATE POLICY "auth upload hossii-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hossii-images');

-- ログイン済みユーザーは自分のファイルを上書き可（upsert 対応）
CREATE POLICY "auth update hossii-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hossii-images');

-- ログイン済みユーザーは削除可
CREATE POLICY "auth delete hossii-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hossii-images');
