-- Fix ambiguous community_id in accept_community_invitation RETURN QUERY

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
  v_cid        uuid;
  v_cname      text;
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

  INSERT INTO public.community_memberships AS cm (
    community_id, auth_user_id, role, status, invited_by, invited_at, accepted_at
  ) VALUES (
    v_inv.community_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.created_at, now()
  )
  ON CONFLICT (community_id, auth_user_id) DO UPDATE
    SET status = 'active',
        role = EXCLUDED.role,
        accepted_at = now(),
        invited_by = COALESCE(cm.invited_by, EXCLUDED.invited_by),
        invited_at = COALESCE(cm.invited_at, EXCLUDED.invited_at);

  UPDATE public.community_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  PERFORM public._community_audit_log(
    v_inv.community_id, 'invitation_accepted', v_uid, v_uid, v_inv.id, '{}'::jsonb
  );

  SELECT c.id, c.name INTO v_cid, v_cname
  FROM public.communities c WHERE c.id = v_inv.community_id;

  community_id := v_cid;
  community_name := v_cname;
  role := v_inv.role;
  status := 'active';
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_community_invitation(text) TO authenticated;
