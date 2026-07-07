-- Phase 5: マイHossii画像アップロード用パス
-- ロールバック: ALTER TABLE user_profiles DROP COLUMN IF EXISTS hossii_image_path;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS hossii_image_path text;

COMMENT ON COLUMN user_profiles.hossii_image_path IS 'マイHossiiのアップロード画像 Storage path（source_type=upload 時）';
