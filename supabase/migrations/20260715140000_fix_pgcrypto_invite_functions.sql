-- Fix pgcrypto calls under SET search_path = '' (Supabase: extensions schema)

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

GRANT EXECUTE ON FUNCTION public.admin_create_community_invitation(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_community_invitation(text) TO authenticated;
