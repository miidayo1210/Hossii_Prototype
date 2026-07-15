-- ============================================================================
-- add_membership_auto_reconcile  (115: community membership 自動整合)
-- ----------------------------------------------------------------------------
-- 目的:
--   active な space_memberships があるのに community_memberships が欠損する
--   状態を防ぐ。join_space_as_member 成功後に不足分のみ INSERT する。
--
-- 範囲:
--   - ensure_community_membership_for_space_member RPC（INSERT のみ・冪等）
--   - join_space_as_member から上記を呼ぶ
--
-- 非対象:
--   - backfill（別 migration）
--   - Edge Function / trigger
--
-- 安全性: append-only。既存行は UPDATE しない。development のみ適用。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. 共通整合 RPC
--    - community_id は spaces から解決（引数で渡された community_id は信用しない）
--    - active space_membership のみがトリガー条件
--    - 既存 community_memberships 行は一切変更しない（ON CONFLICT DO NOTHING）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_community_membership_for_space_member(
  p_space_id     text,
  p_auth_user_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community_id uuid;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = p_space_id) THEN
    RETURN;
  END IF;

  SELECT s.community_id
    INTO v_community_id
  FROM public.spaces s
  WHERE s.id = p_space_id;

  IF v_community_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.space_memberships sm
    WHERE sm.space_id = p_space_id
      AND sm.auth_user_id = p_auth_user_id
      AND sm.status = 'active'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.community_memberships
    (community_id, auth_user_id, role, status, accepted_at)
  VALUES
    (v_community_id, p_auth_user_id, 'member', 'active', now())
  ON CONFLICT (community_id, auth_user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_community_membership_for_space_member(text, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. join_space_as_member: space membership 作成後に整合 RPC を呼ぶ
--    - 既存の参加挙動・戻り値・public shared ゲートは維持
--    - 整合失敗時は WARNING を残し space 参加は維持（115 §エラー時の挙動）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_space_as_member(
  p_space_id       text,
  p_space_nickname text DEFAULT NULL
)
RETURNS public.space_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.space_memberships;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'join_space_as_member: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = p_space_id
      AND s.space_type = 'shared'
      AND COALESCE(s.access_mode, 'public') = 'public'
  ) THEN
    RAISE EXCEPTION 'join_space_as_member: self-join not allowed for this space';
  END IF;

  INSERT INTO public.space_memberships (space_id, auth_user_id, role, status, space_nickname)
  VALUES (p_space_id, v_uid, 'member', 'active', p_space_nickname)
  ON CONFLICT (space_id, auth_user_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_row;

  BEGIN
    PERFORM public.ensure_community_membership_for_space_member(p_space_id, v_uid);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'ensure_community_membership_for_space_member failed for space=% user=%: %',
        p_space_id, v_uid, SQLERRM;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_space_as_member(text, text) TO authenticated;
