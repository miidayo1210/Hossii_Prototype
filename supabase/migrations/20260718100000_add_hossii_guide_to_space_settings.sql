-- Hossiiガイド吹き出し設定（仕様 117）
-- Phase 1: スペース単位の ON/OFF・パッケージ選択を JSONB で保持

ALTER TABLE public.space_settings
  ADD COLUMN IF NOT EXISTS hossii_guide jsonb;

COMMENT ON COLUMN public.space_settings.hossii_guide IS
  'Hossiiガイド吹き出し設定（HossiiGuideSettings）。未設定・enabled:false は guide 非表示。';
