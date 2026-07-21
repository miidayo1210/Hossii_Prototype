-- ============================================================================
-- add_admin_answer_export_rpc  (Phase 1A: 管理者・回答履歴エクスポート)
-- ----------------------------------------------------------------------------
-- 仕様: docs/仕様書/現在の仕様/docs/125_回答履歴エクスポート.md
--
-- スコープ (Phase 1A / commit 1):
--   - space_export_identity_salts（salt は RPC 内部のみ。クライアント SELECT 不可）
--   - admin_export_space_hossiis_page（JSON ページング抽出）
--
-- 自動生成投稿 (§125 §2.1 / §18):
--   hossiis.origin ('manual'|'auto') 列は存在するが、本 Phase では
--   「回答フォーム由来のみ」を origin だけで正確に判別できると断定しない。
--   よって Phase 1A では visibility / deleted / hidden 条件のみで絞り込む。
--   origin='auto' 除外は production データ確認後に別 migration で検討する。
--
-- pgcrypto:
--   20260223000000_initial_schema.sql で CREATE EXTENSION IF NOT EXISTS pgcrypto
--   済み。Supabase では extensions スキーマ経由 (extensions.hmac / extensions.digest)。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) export identity salt（spaces 列ではなく専用テーブル）
--    spaces SELECT (spaces_select_accessible) は can_access_space な利用者全員に
--    行が見えるため、salt を spaces 列に置くと PostgREST の SELECT * で露出する。
--    本テーブルは RLS 有効・policy なし・anon/authenticated への GRANT なし。
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_export_identity_salts (
  space_id             text PRIMARY KEY
                         REFERENCES public.spaces(id) ON DELETE CASCADE,
  export_identity_salt uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.space_export_identity_salts IS
  'Per-space salt for anonymous export IDs. Readable only via SECURITY DEFINER export RPCs. Do not expose via REST.';

ALTER TABLE public.space_export_identity_salts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.space_export_identity_salts FROM PUBLIC;
REVOKE ALL ON TABLE public.space_export_identity_salts FROM anon, authenticated;

-- 既存 space へ個別 UUID を付与（冪等）
INSERT INTO public.space_export_identity_salts (space_id)
SELECT s.id
FROM public.spaces s
ON CONFLICT (space_id) DO NOTHING;

-- 新規 space 作成時も salt 行を自動生成
CREATE OR REPLACE FUNCTION public.ensure_space_export_identity_salt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.space_export_identity_salts (space_id)
  VALUES (NEW.id)
  ON CONFLICT (space_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_space_export_identity_salt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_space_export_identity_salt() FROM anon, authenticated;

DROP TRIGGER IF EXISTS ensure_space_export_identity_salt_after_insert ON public.spaces;
CREATE TRIGGER ensure_space_export_identity_salt_after_insert
  AFTER INSERT ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_space_export_identity_salt();

-- ---------------------------------------------------------------------------
-- 2) admin_export_space_hossiis_page
--    権限: auth.uid() 必須 + is_space_community_admin（super_admin 含む）
--    対象: community 所属 shared space のみ
--    投稿: public / 非deleted / 非hidden のみ（owner_only 除外）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_export_space_hossiis_page(
  p_space_id                       text,
  p_space_pane_id                  text DEFAULT NULL,
  p_cursor_created_at              timestamptz DEFAULT NULL,
  p_cursor_id                      text DEFAULT NULL,
  p_limit                          int DEFAULT 200,
  p_include_author_display_names   boolean DEFAULT false,
  p_include_image_urls             boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_limit          int;
  v_items          jsonb;
  v_page_count     int;
  v_has_more       boolean := false;
  v_next_cursor    jsonb := NULL;
  v_last_created   timestamptz;
  v_last_id        text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_space_community_admin(p_space_id) THEN
    RAISE EXCEPTION 'not authorized to export this space';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = p_space_id
      AND s.space_type = 'shared'
      AND s.community_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'space is not an exportable shared community space';
  END IF;

  IF (p_cursor_created_at IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'cursor requires both created_at and id';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);

  WITH base AS (
    SELECT
      h.id,
      h.created_at,
      h.message,
      h.emotion,
      h.hashtags,
      h.number_value,
      h.post_kind,
      h.image_url,
      h.author_name,
      a.auth_user_id,
      CASE
        WHEN a.auth_user_id IS NULL THEN 'guest'
        WHEN EXISTS (
          SELECT 1
          FROM public.space_participant_accounts spa
          WHERE spa.space_id = h.space_id
            AND spa.auth_user_id = a.auth_user_id
            AND spa.status = 'active'
        ) THEN 'participant_account'
        ELSE 'account'
      END AS author_type,
      CASE
        WHEN a.auth_user_id IS NOT NULL THEN 'a:' || a.auth_user_id::text
        WHEN h.author_id IS NOT NULL AND btrim(h.author_id) <> '' THEN 'g:' || h.author_id
        ELSE 'u:' || h.id
      END AS identity_key,
      COALESCE(sp.name, '') AS pane_name,
      CASE
        WHEN p_include_author_display_names AND a.auth_user_id IS NULL THEN
          NULLIF(btrim(h.author_name), '')
        WHEN p_include_author_display_names THEN
          NULLIF(btrim(COALESCE(m.space_nickname, h.author_name)), '')
        ELSE NULL
      END AS author_display_name
    FROM public.hossiis h
    LEFT JOIN public.hossii_authorships a
      ON a.hossii_id = h.id
    LEFT JOIN public.space_panes sp
      ON sp.id = h.space_pane_id
    LEFT JOIN public.space_memberships m
      ON m.space_id = h.space_id
     AND m.auth_user_id = a.auth_user_id
    WHERE h.space_id = p_space_id
      AND h.deleted_at IS NULL
      AND h.visibility = 'public'
      AND COALESCE(h.is_hidden, false) = false
      AND (p_space_pane_id IS NULL OR h.space_pane_id = p_space_pane_id)
      AND (
        p_cursor_created_at IS NULL
        OR (h.created_at, h.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT v_limit + 1
  ),
  enriched AS (
    SELECT
      b.*,
      substring(
        encode(
          extensions.hmac(
            convert_to(b.identity_key, 'UTF8'),
            convert_to(
              ses.space_id || ':' || ses.export_identity_salt::text,
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        ),
        1,
        16
      ) AS anonymous_id,
      (b.image_url IS NOT NULL AND btrim(b.image_url) <> '') AS has_image
    FROM base b
    JOIN public.space_export_identity_salts ses
      ON ses.space_id = p_space_id
  ),
  limited AS (
    SELECT *
    FROM enriched
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'hossii_id', l.id,
            'created_at', l.created_at,
            'pane_name', l.pane_name,
            'author_type', l.author_type,
            'anonymous_id', l.anonymous_id,
            'message', l.message,
            'emotion', l.emotion,
            'hashtags', COALESCE(l.hashtags, ARRAY[]::text[]),
            'number_value', l.number_value,
            'post_kind', COALESCE(l.post_kind, 'bubble'),
            'has_image', l.has_image
          )
          || CASE
               WHEN p_include_author_display_names AND l.author_display_name IS NOT NULL
               THEN jsonb_build_object('author_display_name', l.author_display_name)
               ELSE '{}'::jsonb
             END
          || CASE
               WHEN p_include_image_urls
                AND l.image_url IS NOT NULL
                AND btrim(l.image_url) <> ''
               THEN jsonb_build_object('image_url', l.image_url)
               ELSE '{}'::jsonb
             END
          ORDER BY l.created_at DESC, l.id DESC
        )
        FROM limited l
      ),
      '[]'::jsonb
    ),
    (SELECT count(*)::int FROM limited),
    (SELECT bcnt.fetched > v_limit FROM (SELECT count(*)::int AS fetched FROM base) bcnt),
    (SELECT lc.created_at FROM limited lc ORDER BY lc.created_at ASC, lc.id ASC LIMIT 1),
    (SELECT lc.id FROM limited lc ORDER BY lc.created_at ASC, lc.id ASC LIMIT 1)
  INTO v_items, v_page_count, v_has_more, v_last_created, v_last_id;

  IF v_page_count > 0 AND v_has_more THEN
    v_next_cursor := jsonb_build_object(
      'created_at', v_last_created,
      'id', v_last_id
    );
  ELSE
    v_has_more := false;
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor,
    'has_more', v_has_more,
    'page_count', COALESCE(v_page_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_export_space_hossiis_page(
  text, text, timestamptz, text, int, boolean, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_export_space_hossiis_page(
  text, text, timestamptz, text, int, boolean, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_export_space_hossiis_page(
  text, text, timestamptz, text, int, boolean, boolean
) TO authenticated;
