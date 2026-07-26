-- ============================================================
-- Hotfix: resolve_participant_login が Auth 内部メールを返すよう復元
--
-- 背景:
--   20260714100000_add_invite_only_access_mode.sql が
--   resolve_participant_login の戻り値を spa.auth_user_id::text に差し替え、
--   さらに can_access_space でゲートしたため、参加 ID ログインが失敗する。
--
-- 方針（最小 hotfix）:
--   - 戻り値を spa.auth_email（発行時に保存した Auth 内部識別子）へ戻す
--   - login_id は lower(trim(...)) で正規化
--   - active 行のみ / space_id 単位で解決
--   - ログイン前利用を妨げる can_access_space ゲートは外す
--   - 既存データの削除・再発行は行わない
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_participant_login(
  p_space_id text,
  p_login_id text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT spa.auth_email
  FROM public.space_participant_accounts spa
  WHERE spa.space_id = p_space_id
    AND spa.login_id = lower(trim(p_login_id))
    AND spa.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_participant_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_participant_login(text, text) TO anon, authenticated;
