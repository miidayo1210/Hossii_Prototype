-- ============================================================
-- Author pane move + super_admin content edit / soft delete
--
-- 1) move_my_hossii_to_pane: authorship 本人が同一 space の pane へ移動
-- 2) guard_hossii_admin_columns: space_pane_id のみ変更かつ本人なら許可
-- 3) super_admin_update_hossii / super_admin_soft_delete_hossii
--    JWT role=super_admin のみ。通常コミュニティ管理者は対象外。
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1) 管理者列ガード: 本人の pane 移動のみ例外を追加
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_hossii_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pane_only boolean;
  v_is_author boolean;
BEGIN
  IF (
       NEW.is_hidden     IS DISTINCT FROM OLD.is_hidden
    OR NEW.hidden_at     IS DISTINCT FROM OLD.hidden_at
    OR NEW.hidden_by     IS DISTINCT FROM OLD.hidden_by
    OR NEW.space_pane_id IS DISTINCT FROM OLD.space_pane_id
  ) AND auth.uid() IS NOT NULL THEN
    IF (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      OR EXISTS (
        SELECT 1
        FROM public.spaces s
        JOIN public.communities c ON c.id = s.community_id
        WHERE s.id = NEW.space_id
          AND c.admin_id = auth.uid()
      )
    ) THEN
      -- コミュニティ管理者 / super_admin: hidden_by 強制
      IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
         OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by THEN
        NEW.hidden_by := CASE WHEN NEW.is_hidden THEN auth.uid()::text ELSE NULL END;
      END IF;
    ELSE
      v_pane_only :=
           NEW.space_pane_id IS DISTINCT FROM OLD.space_pane_id
       AND NEW.is_hidden IS NOT DISTINCT FROM OLD.is_hidden
       AND NEW.hidden_at IS NOT DISTINCT FROM OLD.hidden_at
       AND NEW.hidden_by IS NOT DISTINCT FROM OLD.hidden_by;

      SELECT EXISTS (
        SELECT 1
        FROM public.hossii_authorships a
        WHERE a.hossii_id = NEW.id
          AND a.auth_user_id = auth.uid()
      ) INTO v_is_author;

      IF NOT (v_pane_only AND v_is_author) THEN
        RAISE EXCEPTION 'hossiis moderation columns (is_hidden/hidden_at/hidden_by/space_pane_id) require community admin or super_admin';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) 本人: pane 移動
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_my_hossii_to_pane(
  p_hossii_id text,
  p_pane_id   text
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
  IF p_pane_id IS NULL OR length(trim(p_pane_id)) = 0 THEN
    RAISE EXCEPTION 'pane id is required';
  END IF;

  SELECT h.space_id INTO v_space_id
  FROM public.hossiis h
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL;

  IF v_space_id IS NULL THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;

  PERFORM public.assert_space_not_archived_for_write(v_space_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.hossii_authorships a
    WHERE a.hossii_id = p_hossii_id
      AND a.auth_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.space_panes sp
    WHERE sp.id = p_pane_id
      AND sp.space_id = v_space_id
  ) THEN
    RAISE EXCEPTION 'pane not found in the same space';
  END IF;

  UPDATE public.hossiis h
  SET space_pane_id = p_pane_id
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

REVOKE ALL ON FUNCTION public.move_my_hossii_to_pane(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_my_hossii_to_pane(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) スーパー管理者: 本文編集 / soft delete（他人投稿含む）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.super_admin_update_hossii(
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
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;
  IF p_message IS NULL THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  SELECT h.space_id INTO v_space_id
  FROM public.hossiis h
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL;

  IF v_space_id IS NULL THEN
    RAISE EXCEPTION 'hossii not found or deleted';
  END IF;

  PERFORM public.assert_space_not_archived_for_write(v_space_id);

  UPDATE public.hossiis h
  SET message = p_message,
      content_edited_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
  RETURNING h.content_edited_at INTO v_edited;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found or deleted';
  END IF;

  RETURN v_edited;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_soft_delete_hossii(
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
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'super_admin required';
  END IF;

  SELECT h.space_id INTO v_space_id
  FROM public.hossiis h
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL;

  IF v_space_id IS NULL THEN
    RAISE EXCEPTION 'hossii not found or already deleted';
  END IF;

  PERFORM public.assert_space_not_archived_for_write(v_space_id);

  UPDATE public.hossiis h
  SET deleted_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found or already deleted';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_update_hossii(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_soft_delete_hossii(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_update_hossii(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_soft_delete_hossii(text) TO authenticated;
