-- ============================================================================
-- add_invite_only_access_mode  (Phase 5: shared space の public / invite_only)
-- ----------------------------------------------------------------------------
-- 目的（109 §12 / §17）:
--   共有スペースに access_mode ('public' | 'invite_only') を導入し、
--   can_access_space を一元判定の正本として invite_only を保護する。
--   personal space の access とは別軸。既存スペースは DEFAULT 'public' で後方互換。
--
-- invite_only の正式 access:
--   - active space_memberships.status = 'active'
--   - 所属コミュニティ管理者（communities.admin_id）
--   - super_admin
--   community member であるだけでは不可。guest 不可。
--
-- 保護対象: spaces / hossiis / space_panes / space_settings / space_nicknames /
--   space_feature_flags / space_neighbors / bottle_deliveries の SELECT、
--   hossiis INSERT、主要 SECURITY DEFINER RPC。
--   未アクセス時は行を返さず（存在漏洩を抑える）。
--
-- 安全性: 冪等。destructive DML なし。development のみ。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. access_mode 列（shared のみ意味を持つ。personal は無視）
-- ---------------------------------------------------------------------------
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public';

ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_access_mode_check;
ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_access_mode_check
  CHECK (access_mode IN ('public', 'invite_only'));

-- ---------------------------------------------------------------------------
-- 2. コミュニティ管理者判定ヘルパ（権限正本: communities.admin_id / super_admin）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_space_community_admin(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = p_space_id
        AND c.admin_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_space_community_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_space_community_admin(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. can_access_space を invite_only 対応へ拡張
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_space(p_space_id text)
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
      AND (
        -- personal: Phase 3 確定仕様を維持
        (
          s.space_type = 'personal'
          AND (
            (s.owner_user_id = auth.uid() AND s.status = 'active')
            OR EXISTS (
              SELECT 1 FROM public.communities c
              WHERE c.id = s.community_id AND c.admin_id = auth.uid()
            )
            OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
          )
        )
        OR
        -- shared + public: 従来どおり全員（guest 含む）
        (
          s.space_type = 'shared'
          AND COALESCE(s.access_mode, 'public') = 'public'
        )
        OR
        -- shared + invite_only: active space member / 所属管理者 / super_admin
        (
          s.space_type = 'shared'
          AND s.access_mode = 'invite_only'
          AND (
            EXISTS (
              SELECT 1 FROM public.space_memberships sm
              WHERE sm.space_id = s.id
                AND sm.auth_user_id = auth.uid()
                AND sm.status = 'active'
            )
            OR EXISTS (
              SELECT 1 FROM public.communities c
              WHERE c.id = s.community_id AND c.admin_id = auth.uid()
            )
            OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_space(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_space(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 関連テーブルの SELECT / INSERT を can_access_space に束ねる
-- ---------------------------------------------------------------------------

-- space_settings
DROP POLICY IF EXISTS "public read space_settings" ON public.space_settings;
DROP POLICY IF EXISTS "space_settings_select_accessible" ON public.space_settings;
CREATE POLICY "space_settings_select_accessible" ON public.space_settings
  FOR SELECT USING (public.can_access_space(space_id));

-- space_nicknames（public のゲスト体験は can_access_space=true のときのみ維持）
DROP POLICY IF EXISTS "public read space_nicknames" ON public.space_nicknames;
DROP POLICY IF EXISTS "public insert space_nicknames" ON public.space_nicknames;
DROP POLICY IF EXISTS "public update space_nicknames" ON public.space_nicknames;
DROP POLICY IF EXISTS "public delete space_nicknames" ON public.space_nicknames;
DROP POLICY IF EXISTS "space_nicknames_select_accessible" ON public.space_nicknames;
DROP POLICY IF EXISTS "space_nicknames_insert_accessible" ON public.space_nicknames;
DROP POLICY IF EXISTS "space_nicknames_update_accessible" ON public.space_nicknames;
DROP POLICY IF EXISTS "space_nicknames_delete_accessible" ON public.space_nicknames;

CREATE POLICY "space_nicknames_select_accessible" ON public.space_nicknames
  FOR SELECT USING (public.can_access_space(space_id));
CREATE POLICY "space_nicknames_insert_accessible" ON public.space_nicknames
  FOR INSERT WITH CHECK (public.can_access_space(space_id));
CREATE POLICY "space_nicknames_update_accessible" ON public.space_nicknames
  FOR UPDATE USING (public.can_access_space(space_id));
CREATE POLICY "space_nicknames_delete_accessible" ON public.space_nicknames
  FOR DELETE USING (public.can_access_space(space_id));

-- hossiis INSERT（public のゲスト投稿を維持しつつ invite_only を遮断）
DROP POLICY IF EXISTS "public insert hossiis" ON public.hossiis;
DROP POLICY IF EXISTS "hossiis_insert_accessible" ON public.hossiis;
CREATE POLICY "hossiis_insert_accessible" ON public.hossiis
  FOR INSERT WITH CHECK (public.can_access_space(space_id));

-- space_feature_flags
DROP POLICY IF EXISTS "space_feature_flags_select_all" ON public.space_feature_flags;
DROP POLICY IF EXISTS "space_feature_flags_select_accessible" ON public.space_feature_flags;
CREATE POLICY "space_feature_flags_select_accessible" ON public.space_feature_flags
  FOR SELECT USING (public.can_access_space(space_id));

-- space_neighbors
DROP POLICY IF EXISTS "public read space_neighbors" ON public.space_neighbors;
DROP POLICY IF EXISTS "space_neighbors_select_accessible" ON public.space_neighbors;
CREATE POLICY "space_neighbors_select_accessible" ON public.space_neighbors
  FOR SELECT USING (public.can_access_space(space_id));

-- bottle_deliveries
DROP POLICY IF EXISTS "public read bottle_deliveries" ON public.bottle_deliveries;
DROP POLICY IF EXISTS "bottle_deliveries_select_accessible" ON public.bottle_deliveries;
CREATE POLICY "bottle_deliveries_select_accessible" ON public.bottle_deliveries
  FOR SELECT USING (public.can_access_space(space_id));

-- ---------------------------------------------------------------------------
-- 5. join_space_as_member: public shared のみ自己参加可（invite_only は管理者 RPC のみ）
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

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_space_as_member(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC ハードニング: can_access_space ゲート
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fetch_space_post_author_display_names(
  p_space_id text
)
RETURNS TABLE (
  hossii_id              text,
  current_space_nickname text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT h.id AS hossii_id,
         m.space_nickname AS current_space_nickname
  FROM public.hossiis h
  JOIN public.hossii_authorships a
    ON a.hossii_id = h.id
  JOIN public.space_memberships m
    ON m.space_id = h.space_id
   AND m.auth_user_id = a.auth_user_id
  WHERE public.can_access_space(p_space_id)
    AND h.space_id = p_space_id
    AND h.deleted_at IS NULL
    AND (
      h.visibility = 'public'
      OR a.auth_user_id = auth.uid()
    )
    AND m.space_nickname IS NOT NULL
    AND btrim(m.space_nickname) <> '';
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

CREATE OR REPLACE FUNCTION public.list_my_hossii_participants(p_space_id text)
RETURNS TABLE (
  user_id uuid,
  nickname text,
  hossii_source_type text,
  hossii_preset_key text,
  hossii_image_path text,
  hossii_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH space_gate AS (
    SELECT s.id
    FROM public.spaces s
    WHERE s.id = p_space_id
      AND public.can_access_space(p_space_id)
  ),
  candidates AS (
    SELECT
      up.id AS user_id,
      NULLIF(btrim(sn.nickname), '') AS nickname
    FROM space_gate sg
    INNER JOIN public.space_nicknames sn
      ON sn.space_id = sg.id
    INNER JOIN public.user_profiles up
      ON up.id::text = sn.profile_id

    UNION ALL

    SELECT
      spa.auth_user_id AS user_id,
      COALESCE(
        NULLIF(btrim(sn.nickname), ''),
        NULLIF(btrim(p.default_nickname), ''),
        NULLIF(btrim(up.username), ''),
        ''
      ) AS nickname
    FROM space_gate sg
    INNER JOIN public.space_participant_accounts spa
      ON spa.space_id = sg.id
    INNER JOIN public.user_profiles up
      ON up.id = spa.auth_user_id
    LEFT JOIN public.space_nicknames sn
      ON sn.space_id = sg.id
     AND sn.profile_id = spa.auth_user_id::text
    LEFT JOIN public.profiles p
      ON p.id = spa.auth_user_id::text
    WHERE spa.status = 'active'
  ),
  deduped AS (
    SELECT DISTINCT ON (c.user_id)
      c.user_id,
      c.nickname
    FROM candidates c
    ORDER BY c.user_id, (c.nickname IS NOT NULL AND c.nickname <> '') DESC, c.nickname
  )
  SELECT
    d.user_id,
    COALESCE(NULLIF(btrim(d.nickname), ''), NULLIF(btrim(up.username), ''), 'ユーザー') AS nickname,
    up.hossii_source_type,
    COALESCE(
      up.hossii_preset_key,
      NULLIF(up.hossii_custom_config ->> 'baseKey', '')
    ) AS hossii_preset_key,
    up.hossii_image_path,
    up.hossii_updated_at
  FROM deduped d
  INNER JOIN public.user_profiles up
    ON up.id = d.user_id
  LEFT JOIN public.space_my_hossii_preferences pref
    ON pref.space_id = p_space_id
   AND pref.user_id = d.user_id
  WHERE up.hossii_source_type IS NOT NULL
    AND (
      (up.hossii_source_type = 'preset' AND up.hossii_preset_key IS NOT NULL)
      OR (up.hossii_source_type = 'upload' AND up.hossii_image_path IS NOT NULL)
      OR (
        up.hossii_source_type = 'custom'
        AND NULLIF(up.hossii_custom_config ->> 'baseKey', '') IS NOT NULL
      )
    )
    AND COALESCE(pref.is_visible, true) = true;
$$;

CREATE OR REPLACE FUNCTION public.update_my_space_nickname(
  p_space_id       text,
  p_space_nickname text
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
    RAISE EXCEPTION 'update_my_space_nickname: not authenticated';
  END IF;

  IF NOT public.can_access_space(p_space_id) THEN
    RAISE EXCEPTION 'update_my_space_nickname: space not accessible';
  END IF;

  v_nickname := btrim(coalesce(p_space_nickname, ''));

  IF v_nickname = '' THEN
    v_nickname := NULL;
  ELSE
    IF char_length(v_nickname) > 50 THEN
      RAISE EXCEPTION 'update_my_space_nickname: nickname too long';
    END IF;
    IF v_nickname ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'update_my_space_nickname: nickname contains control characters';
    END IF;
  END IF;

  UPDATE public.space_memberships m
  SET space_nickname = v_nickname
  WHERE m.space_id = p_space_id
    AND m.auth_user_id = v_uid
    AND m.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_my_space_nickname: active membership not found';
  END IF;

  RETURN v_nickname;
END;
$$;

-- hossii 本人操作 RPC に space access ゲートを追加
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
  v_uid    uuid := auth.uid();
  v_edited timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_message IS NULL THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  UPDATE public.hossiis h
  SET message = p_message,
      content_edited_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND public.can_access_space(h.space_id)
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
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_visibility NOT IN ('public', 'owner_only') THEN
    RAISE EXCEPTION 'invalid visibility';
  END IF;

  UPDATE public.hossiis h
  SET visibility = p_visibility
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND public.can_access_space(h.space_id)
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_my_hossii(p_hossii_id text)
RETURNS void
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

  UPDATE public.hossiis h
  SET deleted_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND public.can_access_space(h.space_id)
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, already deleted, or not owned by current user';
  END IF;
END;
$$;

-- participant login も space access でゲート
CREATE OR REPLACE FUNCTION public.resolve_participant_login(
  p_space_id text,
  p_login_id text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT spa.auth_user_id::text
  FROM public.space_participant_accounts spa
  WHERE public.can_access_space(p_space_id)
    AND spa.space_id = p_space_id
    AND spa.login_id = p_login_id
    AND spa.status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.fetch_space_post_author_display_names(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_space_post_author_display_names(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_hossii_like(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_hossii_like(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.list_my_hossii_participants(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_hossii_participants(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.update_my_space_nickname(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_space_nickname(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_space_nickname(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_my_hossii(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_hossii(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_hossii(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_my_hossii_visibility(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_hossii_visibility(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_hossii_visibility(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.soft_delete_my_hossii(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_my_hossii(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_my_hossii(text) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_participant_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_participant_login(text, text) TO anon, authenticated;
