-- ============================================================================
-- add_community_membership_admin  (Phase 6: 招待 RPC + membership 管理 RPC)
-- ----------------------------------------------------------------------------
-- 目的:
--   招待作成・受諾・revoke、メンバー一覧・suspend/reactivate/remove、
--   community HOME データ、community nickname 更新。
--
-- 安全性: token は hash のみ保存。受諾は transaction 内。development のみ。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. list_my_community_memberships を拡張（nickname / slug / description）
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_my_community_memberships();

CREATE OR REPLACE FUNCTION public.list_my_community_memberships()
RETURNS TABLE (
  community_id        uuid,
  community_name      text,
  community_slug      text,
  community_description text,
  role                text,
  status              text,
  community_nickname  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    cm.community_id,
    c.name AS community_name,
    c.slug AS community_slug,
    c.description AS community_description,
    cm.role,
    cm.status,
    cm.community_nickname
  FROM public.community_memberships cm
  JOIN public.communities c ON c.id = cm.community_id
  WHERE cm.auth_user_id = auth.uid()
  ORDER BY c.name;
$$;

-- ---------------------------------------------------------------------------
-- 2. update_my_community_nickname
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_community_nickname(
  p_community_id       uuid,
  p_community_nickname text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_nickname text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = p_community_id
      AND cm.auth_user_id = v_uid
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'membership not active';
  END IF;

  v_nickname := btrim(coalesce(p_community_nickname, ''));
  IF v_nickname = '' THEN
    v_nickname := NULL;
  ELSIF char_length(v_nickname) > 50 THEN
    RAISE EXCEPTION 'nickname too long';
  END IF;

  UPDATE public.community_memberships
  SET community_nickname = v_nickname
  WHERE community_id = p_community_id AND auth_user_id = v_uid;

  RETURN v_nickname;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_community_nickname(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_community_nickname(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_community_nickname(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_list_community_members（auth_user_id 非返却）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_community_members(p_community_id uuid)
RETURNS TABLE (
  membership_id      uuid,
  display_name         text,
  role                 text,
  status               text,
  community_nickname   text,
  joined_at            timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  RETURN QUERY
  SELECT
    cm.id AS membership_id,
    COALESCE(
      cm.community_nickname,
      up.username,
      p.default_nickname,
      'Member'
    ) AS display_name,
    cm.role,
    cm.status,
    cm.community_nickname,
    cm.created_at AS joined_at
  FROM public.community_memberships cm
  LEFT JOIN public.user_profiles up ON up.id = cm.auth_user_id
  LEFT JOIN public.profiles p ON p.id = cm.auth_user_id::text
  WHERE cm.community_id = p_community_id
  ORDER BY cm.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_community_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_community_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_community_members(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_suspend / reactivate / remove community member
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_suspend_community_member(
  p_community_id  uuid,
  p_membership_id uuid
)
RETURNS TABLE (membership_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  SELECT cm.auth_user_id, cm.status INTO v_target, v_status
  FROM public.community_memberships cm
  WHERE cm.id = p_membership_id AND cm.community_id = p_community_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'membership not found';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'only active memberships can be suspended';
  END IF;

  UPDATE public.community_memberships
  SET status = 'suspended'
  WHERE id = p_membership_id AND community_id = p_community_id;

  PERFORM public._community_audit_log(
    p_community_id, 'membership_suspended', v_uid, v_target, NULL,
    jsonb_build_object('membership_id', p_membership_id)
  );

  RETURN QUERY SELECT p_membership_id, 'suspended'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_community_member(
  p_community_id  uuid,
  p_membership_id uuid
)
RETURNS TABLE (membership_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  SELECT cm.auth_user_id, cm.status INTO v_target, v_status
  FROM public.community_memberships cm
  WHERE cm.id = p_membership_id AND cm.community_id = p_community_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'membership not found';
  END IF;

  IF v_status NOT IN ('suspended', 'removed') THEN
    RAISE EXCEPTION 'only suspended or removed memberships can be reactivated';
  END IF;

  UPDATE public.community_memberships
  SET status = 'active', accepted_at = COALESCE(accepted_at, now())
  WHERE id = p_membership_id AND community_id = p_community_id;

  PERFORM public._community_audit_log(
    p_community_id, 'membership_reactivated', v_uid, v_target, NULL,
    jsonb_build_object('membership_id', p_membership_id)
  );

  RETURN QUERY SELECT p_membership_id, 'active'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_community_member(
  p_community_id  uuid,
  p_membership_id uuid
)
RETURNS TABLE (membership_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  SELECT cm.auth_user_id, cm.status INTO v_target, v_status
  FROM public.community_memberships cm
  WHERE cm.id = p_membership_id AND cm.community_id = p_community_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'membership not found';
  END IF;

  IF v_status = 'removed' THEN
    RETURN QUERY SELECT p_membership_id, 'removed'::text;
    RETURN;
  END IF;

  UPDATE public.community_memberships
  SET status = 'removed'
  WHERE id = p_membership_id AND community_id = p_community_id;

  PERFORM public._community_audit_log(
    p_community_id, 'membership_removed', v_uid, v_target, NULL,
    jsonb_build_object('membership_id', p_membership_id)
  );

  RETURN QUERY SELECT p_membership_id, 'removed'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_suspend_community_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reactivate_community_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_remove_community_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_suspend_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_community_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_community_member(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. admin_create_community_invitation（raw token を一度だけ返す）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_community_invitation(
  p_community_id uuid,
  p_invitee_email text,
  p_role          text DEFAULT 'member',
  p_expires_in_hours integer DEFAULT 168
)
RETURNS TABLE (
  invitation_id uuid,
  invite_token  text,
  expires_at    timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_email      text;
  v_raw_token  text;
  v_token_hash text;
  v_expires    timestamptz;
  v_inv_id     uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  v_email := lower(btrim(coalesce(p_invitee_email, '')));
  IF v_email = '' OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  IF p_expires_in_hours < 1 OR p_expires_in_hours > 720 THEN
    RAISE EXCEPTION 'invalid expiry';
  END IF;

  v_raw_token := replace(replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_expires := now() + (p_expires_in_hours || ' hours')::interval;

  INSERT INTO public.community_invitations (
    community_id, invitee_email, role, status, token_hash, expires_at, invited_by
  ) VALUES (
    p_community_id, v_email, p_role, 'pending', v_token_hash, v_expires, v_uid
  )
  RETURNING id INTO v_inv_id;

  PERFORM public._community_audit_log(
    p_community_id, 'invitation_created', v_uid, NULL, v_inv_id,
    jsonb_build_object('invitee_email', v_email, 'role', p_role)
  );

  RETURN QUERY SELECT v_inv_id, v_raw_token, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_community_invitation(uuid, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_community_invitation(uuid, text, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_community_invitation(uuid, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. admin_revoke_community_invitation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_community_invitation(
  p_community_id  uuid,
  p_invitation_id uuid
)
RETURNS TABLE (invitation_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  UPDATE public.community_invitations i
  SET status = 'revoked', revoked_at = now()
  WHERE i.id = p_invitation_id
    AND i.community_id = p_community_id
    AND i.status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found or not revocable';
  END IF;

  PERFORM public._community_audit_log(
    p_community_id, 'invitation_revoked', v_uid, NULL, p_invitation_id, '{}'::jsonb
  );

  RETURN QUERY SELECT p_invitation_id, 'revoked'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_community_invitation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_community_invitation(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. admin_list_community_invitations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_community_invitations(p_community_id uuid)
RETURNS TABLE (
  invitation_id uuid,
  invitee_email text,
  role          text,
  status        text,
  expires_at    timestamptz,
  created_at    timestamptz,
  accepted_at   timestamptz,
  revoked_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_community_admin(p_community_id) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  RETURN QUERY
  SELECT
    i.id, i.invitee_email, i.role, i.status,
    i.expires_at, i.created_at, i.accepted_at, i.revoked_at
  FROM public.community_invitations i
  WHERE i.community_id = p_community_id
  ORDER BY i.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_community_invitations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_community_invitations(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. accept_community_invitation（transaction 内で membership 作成）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_community_invitation(p_invite_token text)
RETURNS TABLE (
  community_id   uuid,
  community_name text,
  role           text,
  status         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_email      text;
  v_token_hash text;
  v_inv        public.community_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'invitation invalid';
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u WHERE u.id = v_uid;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invitation invalid';
  END IF;

  v_token_hash := encode(extensions.digest(btrim(coalesce(p_invite_token, '')), 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.community_invitations i
  WHERE i.token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation invalid';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation invalid';
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.community_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'invitation invalid';
  END IF;

  IF lower(v_inv.invitee_email) <> v_email THEN
    RAISE EXCEPTION 'invitation invalid';
  END IF;

  INSERT INTO public.community_memberships (
    community_id, auth_user_id, role, status, invited_by, invited_at, accepted_at
  ) VALUES (
    v_inv.community_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.created_at, now()
  )
  ON CONFLICT (community_id, auth_user_id) DO UPDATE
    SET status = 'active',
        role = EXCLUDED.role,
        accepted_at = now(),
        invited_by = COALESCE(community_memberships.invited_by, EXCLUDED.invited_by),
        invited_at = COALESCE(community_memberships.invited_at, EXCLUDED.invited_at);

  UPDATE public.community_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  PERFORM public._community_audit_log(
    v_inv.community_id, 'invitation_accepted', v_uid, v_uid, v_inv.id, '{}'::jsonb
  );

  RETURN QUERY
  SELECT v_inv.community_id, c.name, v_inv.role, 'active'::text
  FROM public.communities c WHERE c.id = v_inv.community_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_community_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_community_invitation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_community_invitation(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. fetch_community_home（HOME 画面用データ）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_community_home(p_community_id uuid)
RETURNS TABLE (
  community_id          uuid,
  community_name        text,
  community_slug        text,
  community_description text,
  my_role               text,
  my_status             text,
  my_community_nickname text,
  is_community_admin    boolean,
  can_view_private      boolean,
  personal_space_id     text,
  personal_space_url    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean := COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
  v_role text;
  v_status text;
  v_nickname text;
  v_is_admin boolean;
  v_can_private boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT cm.role, cm.status, cm.community_nickname
  INTO v_role, v_status, v_nickname
  FROM public.community_memberships cm
  WHERE cm.community_id = p_community_id AND cm.auth_user_id = v_uid;

  v_is_admin := v_is_super OR EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = p_community_id AND c.admin_id = v_uid
  );

  IF v_role IS NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'not a member of this community';
  END IF;

  v_can_private := v_is_admin OR v_status = 'active';

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.description,
    COALESCE(v_role, CASE WHEN v_is_admin THEN 'admin' ELSE 'member' END),
    COALESCE(v_status, 'active'),
    v_nickname,
    v_is_admin,
    v_can_private,
    ps.id,
    ps.space_url
  FROM public.communities c
  LEFT JOIN public.spaces ps ON ps.community_id = c.id
    AND ps.space_type = 'personal'
    AND ps.owner_user_id = v_uid
    AND ps.status = 'active'
  WHERE c.id = p_community_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_community_home(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fetch_community_home(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fetch_community_home(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. list_community_shared_spaces（HOME 用 shared space 一覧）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_community_shared_spaces(p_community_id uuid)
RETURNS TABLE (
  space_id     text,
  space_name   text,
  space_url    text,
  access_mode  text,
  can_enter    boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_can_content boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_can_content := public.can_access_community_content(p_community_id);

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.space_url,
    COALESCE(s.access_mode, 'public'),
    CASE
      WHEN NOT v_can_content AND COALESCE(s.access_mode, 'public') <> 'public' THEN false
      WHEN NOT v_can_content THEN false
      WHEN COALESCE(s.access_mode, 'public') = 'public' THEN true
      WHEN public.can_access_space(s.id) THEN true
      ELSE false
    END AS can_enter
  FROM public.spaces s
  WHERE s.community_id = p_community_id
    AND s.space_type = 'shared'
    AND s.status = 'active'
  ORDER BY s.name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_community_shared_spaces(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_community_shared_spaces(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_community_shared_spaces(uuid) TO authenticated;
