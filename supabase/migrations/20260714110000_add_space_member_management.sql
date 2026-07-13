-- ============================================================================
-- add_space_member_management  (Phase 5: スペースメンバー管理 RPC)
-- ----------------------------------------------------------------------------
-- 目的（109 §13）:
--   コミュニティ管理者が、管理対象コミュニティ内の共有スペースについて
--   space_memberships を一覧・追加・停止・復帰・解除できる RPC を提供する。
--
-- 権限正本: communities.admin_id または super_admin（membership.role は管理正本にしない）。
-- 別コミュニティ管理者・一般 member・guest は不可。
-- 一覧は auth_user_id を返さず表示名のみ（PII 最小化）。
-- 追加は同一コミュニティの active community member からのみ（public 訪問者の自動追加なし）。
--
-- 状態遷移:
--   [管理者追加] → active
--   active → suspended → active
--   active/suspended → removed
--   removed → active（再招待 = admin_add_space_member）
--
-- 安全性: 冪等。development のみ。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. admin_list_space_members: メンバー一覧（auth_user_id 非返却）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_space_members(p_space_id text)
RETURNS TABLE (
  membership_id  uuid,
  display_name   text,
  role           text,
  status         text,
  space_nickname text,
  joined_at      timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  RETURN QUERY
  SELECT
    sm.id AS membership_id,
    COALESCE(NULLIF(btrim(up.username), ''), 'メンバー') AS display_name,
    sm.role,
    sm.status,
    sm.space_nickname,
    sm.joined_at
  FROM public.space_memberships sm
  JOIN public.user_profiles up ON up.id = sm.auth_user_id
  WHERE sm.space_id = p_space_id
  ORDER BY sm.joined_at ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. admin_add_space_member: community member から追加（初版は active）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_space_member(
  p_space_id     text,
  p_auth_user_id uuid
)
RETURNS TABLE (
  membership_id  uuid,
  display_name   text,
  role           text,
  status         text,
  space_nickname text,
  joined_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community_id uuid;
  v_row public.space_memberships;
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  SELECT s.community_id INTO v_community_id
  FROM public.spaces s
  WHERE s.id = p_space_id AND s.space_type = 'shared';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shared space not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = v_community_id
      AND cm.auth_user_id = p_auth_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'target is not an active member of this community';
  END IF;

  INSERT INTO public.space_memberships (space_id, auth_user_id, role, status)
  VALUES (p_space_id, p_auth_user_id, 'member', 'active')
  ON CONFLICT (space_id, auth_user_id) DO UPDATE
    SET status = 'active',
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN QUERY
  SELECT
    v_row.id,
    COALESCE(NULLIF(btrim(up.username), ''), 'メンバー'),
    v_row.role,
    v_row.status,
    v_row.space_nickname,
    v_row.joined_at
  FROM public.user_profiles up
  WHERE up.id = p_auth_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. admin_suspend_space_member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_suspend_space_member(
  p_space_id      text,
  p_membership_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  status        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.space_memberships;
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  UPDATE public.space_memberships sm
  SET status = 'suspended'
  WHERE sm.id = p_membership_id
    AND sm.space_id = p_space_id
    AND sm.status = 'active'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active membership not found';
  END IF;

  membership_id := v_row.id;
  status := v_row.status;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. admin_reactivate_space_member（suspended / removed から active へ）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reactivate_space_member(
  p_space_id      text,
  p_membership_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  status        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.space_memberships;
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  UPDATE public.space_memberships sm
  SET status = 'active'
  WHERE sm.id = p_membership_id
    AND sm.space_id = p_space_id
    AND sm.status IN ('suspended', 'removed')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'suspended or removed membership not found';
  END IF;

  membership_id := v_row.id;
  status := v_row.status;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. admin_remove_space_member（active/suspended → removed。データは保持）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_remove_space_member(
  p_space_id      text,
  p_membership_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  status        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.space_memberships;
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  UPDATE public.space_memberships sm
  SET status = 'removed'
  WHERE sm.id = p_membership_id
    AND sm.space_id = p_space_id
    AND sm.status IN ('active', 'suspended')
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership not found or already removed';
  END IF;

  membership_id := v_row.id;
  status := v_row.status;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. admin_update_space_access_mode（shared のみ。投稿は削除しない）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_space_access_mode(
  p_space_id    text,
  p_access_mode text
)
RETURNS TABLE (access_mode text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mode text;
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  IF p_access_mode NOT IN ('public', 'invite_only') THEN
    RAISE EXCEPTION 'invalid access_mode';
  END IF;

  UPDATE public.spaces s
  SET access_mode = p_access_mode
  WHERE s.id = p_space_id
    AND s.space_type = 'shared'
  RETURNING s.access_mode INTO v_mode;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'shared space not found';
  END IF;

  access_mode := v_mode;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. admin_list_space_member_candidates: 未追加の active community member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_space_member_candidates(p_space_id text)
RETURNS TABLE (
  auth_user_id uuid,
  display_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community_id uuid;
BEGIN
  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to manage this space';
  END IF;

  SELECT s.community_id INTO v_community_id
  FROM public.spaces s
  WHERE s.id = p_space_id AND s.space_type = 'shared';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shared space not found';
  END IF;

  RETURN QUERY
  SELECT
    cm.auth_user_id,
    COALESCE(NULLIF(btrim(up.username), ''), 'メンバー') AS display_name
  FROM public.community_memberships cm
  JOIN public.user_profiles up ON up.id = cm.auth_user_id
  WHERE cm.community_id = v_community_id
    AND cm.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.space_memberships sm
      WHERE sm.space_id = p_space_id
        AND sm.auth_user_id = cm.auth_user_id
        AND sm.status IN ('active', 'suspended', 'invited')
    )
  ORDER BY display_name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_space_members(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_space_members(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_space_members(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_add_space_member(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_add_space_member(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_space_member(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_suspend_space_member(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suspend_space_member(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_space_member(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_reactivate_space_member(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reactivate_space_member(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_space_member(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_remove_space_member(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_remove_space_member(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_space_member(text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_space_access_mode(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_space_access_mode(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_space_access_mode(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_space_member_candidates(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_space_member_candidates(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_space_member_candidates(text) TO authenticated;
