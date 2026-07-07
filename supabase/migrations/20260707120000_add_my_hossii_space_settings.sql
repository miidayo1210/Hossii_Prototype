-- Phase 2/3: マイHossiiスペース設定
-- ロールバック:
--   ALTER TABLE spaces DROP COLUMN IF EXISTS my_hossii_enabled;
--   ALTER TABLE spaces DROP COLUMN IF EXISTS my_hossii_motion_mode;
--   ALTER TABLE spaces DROP COLUMN IF EXISTS my_hossii_log_visibility;

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS my_hossii_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS my_hossii_motion_mode text NOT NULL DEFAULT 'auto'
    CHECK (my_hossii_motion_mode IN ('free', 'anchored', 'auto')),
  ADD COLUMN IF NOT EXISTS my_hossii_log_visibility text NOT NULL DEFAULT 'public'
    CHECK (my_hossii_log_visibility IN ('public', 'authenticated', 'hidden'));

COMMENT ON COLUMN spaces.my_hossii_enabled IS 'マイHossii表示 ON/OFF。デフォルト false';
COMMENT ON COLUMN spaces.my_hossii_motion_mode IS 'マイHossiiの動き方: free | anchored | auto';
COMMENT ON COLUMN spaces.my_hossii_log_visibility IS 'マイHossiiログ公開範囲: public | authenticated | hidden';
