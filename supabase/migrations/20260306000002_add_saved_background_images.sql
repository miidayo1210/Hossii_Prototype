-- spaces テーブルに背景画像URLリストを追加
-- saved_background_images: 保存済み背景画像の公開URL配列（最大3枚→将来的に拡張予定）

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS saved_background_images jsonb DEFAULT '[]'::jsonb;
