-- ============================================================================
-- add_space_participation_mode  (123 Phase 6A: 共有URL参加方式)
-- ----------------------------------------------------------------------------
-- 目的:
--   共有スペースの participation_mode ('guest_only' | 'guest_and_account' |
--   'account_only') を spaces に追加する。
--   access_mode（誰が中身にアクセスできるか）・ is_private（未ログイン停止）とは
--   別軸。personal スペースではアプリ側で無視する。
--
-- 既存行: DEFAULT 'guest_and_account' により後方互換（Phase 1〜5D 相当）。
-- 安全性: 冪等。destructive DML なし。development のみ（Production 未適用）。
-- ============================================================================

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS participation_mode text NOT NULL DEFAULT 'guest_and_account';

ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_participation_mode_check;
ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_participation_mode_check
  CHECK (participation_mode IN ('guest_only', 'guest_and_account', 'account_only'));

COMMENT ON COLUMN public.spaces.participation_mode IS
  'shared スペースの共有URL参加方式。personal では無視。DEFAULT guest_and_account。';
