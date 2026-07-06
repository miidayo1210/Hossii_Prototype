-- Phase 1: マイHossii設定を user_profiles に追加
-- ロールバック: ALTER TABLE user_profiles DROP COLUMN IF EXISTS hossii_source_type, DROP COLUMN IF EXISTS hossii_preset_key, DROP COLUMN IF EXISTS hossii_updated_at;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS hossii_source_type text
    CHECK (hossii_source_type IS NULL OR hossii_source_type IN ('preset', 'upload')),
  ADD COLUMN IF NOT EXISTS hossii_preset_key text,
  ADD COLUMN IF NOT EXISTS hossii_updated_at timestamptz;

COMMENT ON COLUMN user_profiles.hossii_source_type IS 'マイHossiiの登録方式。Phase 1では preset のみ使用';
COMMENT ON COLUMN user_profiles.hossii_preset_key IS '選択した基本Hossiiプリセットの key';
COMMENT ON COLUMN user_profiles.hossii_updated_at IS 'マイHossii設定の最終更新日時';
