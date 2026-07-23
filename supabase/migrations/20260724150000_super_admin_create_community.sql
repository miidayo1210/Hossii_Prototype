-- ============================================================================
-- super_admin_create_community + owner INSERT hardening (PR-A)
-- ----------------------------------------------------------------------------
-- super admin が申請を経ず approved コミュニティを即時作成する RPC を追加する。
-- 一般ユーザーの owner INSERT は status='pending' のみ許可し、自己承認の穴を塞ぐ。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS hardening: owner INSERT は pending のみ
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "owner insert communities" ON public.communities;

CREATE POLICY "owner insert communities"
  ON public.communities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND status = 'pending'
  );

-- ---------------------------------------------------------------------------
-- 2. slug 生成（DB 内部用。8 文字 [a-z0-9]）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_community_slug()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $$
DECLARE
  v_chars constant text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  v_result text := '';
  v_i integer;
  v_idx integer;
BEGIN
  FOR v_i IN 1..8 LOOP
    v_idx := 1 + floor(random() * length(v_chars))::integer;
    v_result := v_result || substr(v_chars, v_idx, 1);
  END LOOP;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_community_slug() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_community_slug() FROM anon;
REVOKE ALL ON FUNCTION public.generate_community_slug() FROM authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC: super_admin_create_community
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.super_admin_create_community(
  p_name text
)
RETURNS public.communities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean := COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
    false
  );
  v_name text := btrim(p_name);
  v_slug text;
  v_community public.communities;
  v_attempt integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT v_is_super THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'community name is required';
  END IF;

  FOR v_attempt IN 1..10 LOOP
    v_slug := public.generate_community_slug();

    BEGIN
      INSERT INTO public.communities (admin_id, name, slug, status)
      VALUES (v_uid, v_name, v_slug, 'approved')
      RETURNING * INTO v_community;

      INSERT INTO public.community_memberships
        (community_id, auth_user_id, role, status, invited_by, accepted_at)
      VALUES
        (v_community.id, v_uid, 'admin', 'active', v_uid, now());

      RETURN v_community;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt = 10 THEN
          RAISE EXCEPTION 'failed to generate unique community slug';
        END IF;
    END;
  END LOOP;

  RAISE EXCEPTION 'failed to create community';
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_create_community(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_create_community(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.super_admin_create_community(text) TO authenticated;
