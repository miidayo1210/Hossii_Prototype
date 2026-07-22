-- ============================================================================
-- add_hossii_connections  (126 Phase 1: DB + RLS only)
-- ----------------------------------------------------------------------------
-- Hossii 同士の糸（connection）を pane スコープで保存する。
-- 書き込み: community admin / super_admin のみ（RLS）。
-- 整合性: BEFORE trigger（正規化・endpoint 検証・archived 拒否・created_by 正本）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hossii_connections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id         text        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  pane_id          text        NOT NULL REFERENCES public.space_panes(id) ON DELETE CASCADE,
  source_hossii_id text        NOT NULL REFERENCES public.hossiis(id) ON DELETE CASCADE,
  target_hossii_id text        NOT NULL REFERENCES public.hossiis(id) ON DELETE CASCADE,
  strength         text        NOT NULL CHECK (strength IN ('soft', 'medium', 'strong')),
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hossii_connections_no_self CHECK (source_hossii_id <> target_hossii_id),
  CONSTRAINT hossii_connections_pair_unique UNIQUE (
    space_id,
    pane_id,
    source_hossii_id,
    target_hossii_id
  )
);

CREATE INDEX IF NOT EXISTS hossii_connections_space_pane_idx
  ON public.hossii_connections (space_id, pane_id);

CREATE INDEX IF NOT EXISTS hossii_connections_source_idx
  ON public.hossii_connections (source_hossii_id);

CREATE INDEX IF NOT EXISTS hossii_connections_target_idx
  ON public.hossii_connections (target_hossii_id);

-- ---------------------------------------------------------------------------
-- 2. helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_hossii_connection_admin(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR public.is_space_community_admin(p_space_id);
$$;

REVOKE ALL ON FUNCTION public.is_hossii_connection_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_hossii_connection_admin(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hossii_effective_pane_id(p_hossii_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(h.space_pane_id, h.space_id || '-pane-default')
      FROM public.hossiis h
      WHERE h.id = p_hossii_id
    ),
    NULL
  );
$$;

REVOKE ALL ON FUNCTION public.hossii_effective_pane_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hossii_effective_pane_id(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.hossii_connection_endpoint_readable(p_hossii_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hossiis h
    WHERE h.id = p_hossii_id
      AND h.deleted_at IS NULL
      AND COALESCE(h.is_hidden, false) = false
      AND (
        h.visibility = 'public'
        OR (
          h.visibility = 'owner_only'
          AND public.hossii_is_owned_by_current_user(h.id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.hossii_connection_endpoint_readable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hossii_connection_endpoint_readable(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. row guard trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_hossii_connection_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tmp text;
  v_src_space text;
  v_tgt_space text;
  v_src_pane text;
  v_tgt_pane text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.assert_space_not_archived_for_write(OLD.space_id);
    RETURN OLD;
  END IF;

  PERFORM public.assert_space_not_archived_for_write(NEW.space_id);

  IF NEW.source_hossii_id > NEW.target_hossii_id THEN
    v_tmp := NEW.source_hossii_id;
    NEW.source_hossii_id := NEW.target_hossii_id;
    NEW.target_hossii_id := v_tmp;
  END IF;

  IF NEW.source_hossii_id = NEW.target_hossii_id THEN
    RAISE EXCEPTION 'cannot connect hossii to itself';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.space_panes p
    WHERE p.id = NEW.pane_id
      AND p.space_id = NEW.space_id
  ) THEN
    RAISE EXCEPTION 'pane_id does not belong to space_id';
  END IF;

  SELECT h.space_id, COALESCE(h.space_pane_id, h.space_id || '-pane-default')
  INTO v_src_space, v_src_pane
  FROM public.hossiis h
  WHERE h.id = NEW.source_hossii_id
    AND h.deleted_at IS NULL
    AND COALESCE(h.is_hidden, false) = false;

  IF v_src_space IS NULL THEN
    RAISE EXCEPTION 'source hossii is not available for connection';
  END IF;

  SELECT h.space_id, COALESCE(h.space_pane_id, h.space_id || '-pane-default')
  INTO v_tgt_space, v_tgt_pane
  FROM public.hossiis h
  WHERE h.id = NEW.target_hossii_id
    AND h.deleted_at IS NULL
    AND COALESCE(h.is_hidden, false) = false;

  IF v_tgt_space IS NULL THEN
    RAISE EXCEPTION 'target hossii is not available for connection';
  END IF;

  IF v_src_space <> NEW.space_id OR v_tgt_space <> NEW.space_id THEN
    RAISE EXCEPTION 'both hossiis must belong to connection space_id';
  END IF;

  IF v_src_space <> v_tgt_space THEN
    RAISE EXCEPTION 'hossiis must belong to the same space';
  END IF;

  IF v_src_pane <> NEW.pane_id OR v_tgt_pane <> NEW.pane_id THEN
    RAISE EXCEPTION 'both hossiis must belong to connection pane_id';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_hossii_connection_row() FROM PUBLIC;

DROP TRIGGER IF EXISTS hossii_connections_guard_row ON public.hossii_connections;
CREATE TRIGGER hossii_connections_guard_row
  BEFORE INSERT OR UPDATE OR DELETE ON public.hossii_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_hossii_connection_row();

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.hossii_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hossii_connections_select_accessible"
  ON public.hossii_connections
  FOR SELECT
  USING (
    public.can_access_space(space_id)
    AND public.hossii_connection_endpoint_readable(source_hossii_id)
    AND public.hossii_connection_endpoint_readable(target_hossii_id)
  );

CREATE POLICY "hossii_connections_insert_admin"
  ON public.hossii_connections
  FOR INSERT
  WITH CHECK (public.is_hossii_connection_admin(space_id));

CREATE POLICY "hossii_connections_update_admin"
  ON public.hossii_connections
  FOR UPDATE
  USING (public.is_hossii_connection_admin(space_id))
  WITH CHECK (public.is_hossii_connection_admin(space_id));

CREATE POLICY "hossii_connections_delete_admin"
  ON public.hossii_connections
  FOR DELETE
  USING (public.is_hossii_connection_admin(space_id));

CREATE POLICY "hossii_connections_super_admin_all"
  ON public.hossii_connections
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- ---------------------------------------------------------------------------
-- 5. grants（RLS 下。不要な anon write は付与しない）
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.hossii_connections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hossii_connections TO authenticated;
