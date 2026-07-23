-- ============================================================================
-- add_hossii_connection_type_a_participant_rls  (126 T1.4 / T1.5)
-- ----------------------------------------------------------------------------
-- Type A connection 作成を formal space 参加者へ開放する。
-- UPDATE / DELETE は作成者本人または connection admin のみ。
-- guard_hossii_connection_row / reason 正規化 / SELECT RLS は変更しない。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_space_member(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_memberships sm
    WHERE sm.space_id = p_space_id
      AND sm.auth_user_id = auth.uid()
      AND sm.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_space_member(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_space_member(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_personal_space_owner(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = p_space_id
      AND s.space_type = 'personal'
      AND s.owner_user_id = auth.uid()
      AND s.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_personal_space_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_personal_space_owner(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_create_hossii_connection(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_hossii_connection_admin(p_space_id)
    OR public.is_active_space_member(p_space_id)
    OR public.is_personal_space_owner(p_space_id);
$$;

REVOKE ALL ON FUNCTION public.can_create_hossii_connection(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_hossii_connection(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. RLS — INSERT / UPDATE / DELETE
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "hossii_connections_insert_admin" ON public.hossii_connections;

CREATE POLICY "hossii_connections_insert_participant"
  ON public.hossii_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_create_hossii_connection(space_id));

DROP POLICY IF EXISTS "hossii_connections_update_admin" ON public.hossii_connections;

CREATE POLICY "hossii_connections_update_owner_or_admin"
  ON public.hossii_connections
  FOR UPDATE
  TO authenticated
  USING (
    public.is_hossii_connection_admin(space_id)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_hossii_connection_admin(space_id)
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "hossii_connections_delete_admin" ON public.hossii_connections;

CREATE POLICY "hossii_connections_delete_owner_or_admin"
  ON public.hossii_connections
  FOR DELETE
  TO authenticated
  USING (
    public.is_hossii_connection_admin(space_id)
    OR created_by = auth.uid()
  );
