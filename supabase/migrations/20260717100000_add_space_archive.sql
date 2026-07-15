-- ============================================================================
-- add_space_archive  (112: DB + write protection only)
-- ----------------------------------------------------------------------------
-- 目的:
--   spaces にアーカイブ状態を追加し、アーカイブ中の投稿系書き込みを
--   DB 側（RLS / trigger / RPC）で拒否する。閲覧権限（can_access_space）は変更しない。
--
-- 範囲:
--   - is_archived / archived_at / archived_by 列
--   - set_space_archived RPC（管理者のみ ON/OFF）
--   - hossiis / hossii_likes / 本人操作 RPC / increment_hossii_like の書き込み拒否
--
-- 安全性: append-only。既存 migration は変更しない。development のみ適用。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. spaces: archive 列
-- ---------------------------------------------------------------------------
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS archived_by uuid;

COMMENT ON COLUMN public.spaces.is_archived IS
  'true のとき閲覧専用アーカイブ。投稿系の書き込みを DB 側で拒否する。';
COMMENT ON COLUMN public.spaces.archived_at IS 'アーカイブ ON にした時刻。OFF 時は NULL。';
COMMENT ON COLUMN public.spaces.archived_by IS 'アーカイブ ON にした auth.users.id。OFF 時は NULL。';

-- ---------------------------------------------------------------------------
-- 2. helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.space_archive_write_blocked_message()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 'このスペースはアーカイブされているため変更できません'::text;
$$;

REVOKE ALL ON FUNCTION public.space_archive_write_blocked_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.space_archive_write_blocked_message() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.space_is_archived(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT s.is_archived FROM public.spaces s WHERE s.id = p_space_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.space_is_archived(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.space_is_archived(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.hossii_space_is_archived(p_hossii_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT s.is_archived
      FROM public.hossiis h
      JOIN public.spaces s ON s.id = h.space_id
      WHERE h.id = p_hossii_id
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.hossii_space_is_archived(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hossii_space_is_archived(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_space_not_archived_for_write(p_space_id text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.space_is_archived(p_space_id) THEN
    RAISE EXCEPTION '%', public.space_archive_write_blocked_message();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_space_not_archived_for_write(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_space_not_archived_for_write(text) TO anon, authenticated;

-- 既存の管理者正本を利用（client から送られた user_id / community_id は信用しない）
CREATE OR REPLACE FUNCTION public.can_manage_space_archive(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR public.is_space_community_admin(p_space_id)
    OR EXISTS (
      SELECT 1
      FROM public.space_memberships sm
      WHERE sm.space_id = p_space_id
        AND sm.auth_user_id = auth.uid()
        AND sm.status = 'active'
        AND sm.role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.community_memberships cm ON cm.community_id = s.community_id
      WHERE s.id = p_space_id
        AND cm.auth_user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_space_archive(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_space_archive(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. archive ON/OFF RPC（直接 UPDATE では archive 列を変更不可）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_space_archived(
  p_space_id text,
  p_archived boolean
)
RETURNS TABLE (
  space_id text,
  is_archived boolean,
  archived_at timestamptz,
  archived_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.can_manage_space_archive(p_space_id) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = p_space_id) THEN
    RAISE EXCEPTION 'space not found';
  END IF;

  PERFORM set_config('hossii.space_archive_rpc', '1', true);

  IF p_archived THEN
    UPDATE public.spaces s
    SET is_archived = true,
        archived_at = now(),
        archived_by = v_uid
    WHERE s.id = p_space_id;
  ELSE
    UPDATE public.spaces s
    SET is_archived = false,
        archived_at = NULL,
        archived_by = NULL
    WHERE s.id = p_space_id;
  END IF;

  RETURN QUERY
  SELECT s.id, s.is_archived, s.archived_at, s.archived_by
  FROM public.spaces s
  WHERE s.id = p_space_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_space_archived(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_space_archived(text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_space_archived(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_space_archive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.is_archived IS DISTINCT FROM OLD.is_archived
       OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
       OR NEW.archived_by IS DISTINCT FROM OLD.archived_by
     )
     AND current_setting('hossii.space_archive_rpc', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'archive columns must be changed via set_space_archived RPC';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_space_archive_columns ON public.spaces;
CREATE TRIGGER enforce_space_archive_columns
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_space_archive_columns();

-- ---------------------------------------------------------------------------
-- 4. hossiis 書き込み拒否（INSERT / UPDATE / DELETE）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_hossii_archived_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_space_id text;
BEGIN
  v_space_id := COALESCE(NEW.space_id, OLD.space_id);
  IF public.space_is_archived(v_space_id) THEN
    RAISE EXCEPTION '%', public.space_archive_write_blocked_message();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_hossii_archived_write ON public.hossiis;
CREATE TRIGGER guard_hossii_archived_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.hossiis
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_hossii_archived_write();

DROP POLICY IF EXISTS "hossiis_insert_accessible" ON public.hossiis;
CREATE POLICY "hossiis_insert_accessible" ON public.hossiis
  FOR INSERT WITH CHECK (
    public.can_access_space(space_id)
    AND NOT public.space_is_archived(space_id)
  );

-- ---------------------------------------------------------------------------
-- 5. hossii_likes 書き込み拒否（いいね・リアクション）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_hossii_likes_archived_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hossii_id text;
BEGIN
  v_hossii_id := COALESCE(NEW.hossii_id, OLD.hossii_id);
  IF public.hossii_space_is_archived(v_hossii_id) THEN
    RAISE EXCEPTION '%', public.space_archive_write_blocked_message();
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_hossii_likes_archived_write ON public.hossii_likes;
CREATE TRIGGER guard_hossii_likes_archived_write
  BEFORE INSERT OR DELETE ON public.hossii_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_hossii_likes_archived_write();

-- ---------------------------------------------------------------------------
-- 6. 本人操作 RPC + increment_hossii_like
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_hossii(
  p_hossii_id text,
  p_message   text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_space_id text;
  v_edited   timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_message IS NULL THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  SELECT h.space_id INTO v_space_id FROM public.hossiis h WHERE h.id = p_hossii_id;
  PERFORM public.assert_space_not_archived_for_write(v_space_id);

  UPDATE public.hossiis h
  SET message = p_message,
      content_edited_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    )
  RETURNING h.content_edited_at INTO v_edited;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;

  RETURN v_edited;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_hossii_visibility(
  p_hossii_id  text,
  p_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_space_id text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_visibility NOT IN ('public', 'owner_only') THEN
    RAISE EXCEPTION 'invalid visibility';
  END IF;

  SELECT h.space_id INTO v_space_id FROM public.hossiis h WHERE h.id = p_hossii_id;
  PERFORM public.assert_space_not_archived_for_write(v_space_id);

  UPDATE public.hossiis h
  SET visibility = p_visibility
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_my_hossii(
  p_hossii_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_space_id text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT h.space_id INTO v_space_id FROM public.hossiis h WHERE h.id = p_hossii_id;
  PERFORM public.assert_space_not_archived_for_write(v_space_id);

  UPDATE public.hossiis h
  SET deleted_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, already deleted, or not owned by current user';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_hossii_like(p_hossii_id text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.hossiis
  SET like_count = like_count + 1
  WHERE id = p_hossii_id
    AND public.can_access_space(space_id)
    AND NOT public.space_is_archived(space_id)
    AND deleted_at IS NULL
    AND (
      visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.hossii_authorships a
        WHERE a.hossii_id = hossiis.id
          AND a.auth_user_id = auth.uid()
      )
    )
  RETURNING like_count;
$$;

REVOKE ALL ON FUNCTION public.increment_hossii_like(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_hossii_like(text) TO anon, authenticated;
