-- ============================================================================
-- verify-my-space-activity-rpc.sql   (READ ONLY / My Hossii personal activity RPC)
-- ----------------------------------------------------------------------------
-- TARGET: development  uodaubhlcvvqlgsdxcdf
-- DO NOT RUN AGAINST PRODUCTION.
-- SELECT / SET-ROLE only. No INSERT/UPDATE/DELETE/DDL. No PII returned.
-- Paste into the Supabase Dashboard SQL Editor (development) and Run.
--
-- 目的: get_my_space_activity(p_space_id) の
--   - grants（authenticated のみ / anon 不可）
--   - definition（deleted / is_hidden 除外, authorship 正本, can_access_space 整合）
-- を人手で確認する。実データ集計の本人性検証は「開発認証での実行」で行う（下記コメント）。
-- ============================================================================

WITH
-- 1) 関数のセキュリティ属性（SECURITY DEFINER / search_path='' / STABLE）
props_c AS (
  SELECT jsonb_build_object(
    'proname', p.proname,
    'security_definer', p.prosecdef,
    'volatility', CASE p.provolatile WHEN 's' THEN 'stable' WHEN 'i' THEN 'immutable' ELSE 'volatile' END,
    'proconfig', p.proconfig,           -- 期待: {search_path=""}
    'returns', pg_catalog.format_type(p.prorettype, NULL)  -- 期待: jsonb
  ) AS d
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_my_space_activity'
),
-- 2) EXECUTE grants（authenticated=true / anon=false / public=false）
grants_c AS (
  SELECT jsonb_build_object(
    'authenticated', has_function_privilege('authenticated', 'public.get_my_space_activity(text)', 'EXECUTE'),
    'anon',          has_function_privilege('anon',          'public.get_my_space_activity(text)', 'EXECUTE')
  ) AS d
),
-- 3) 定義内に本人性・除外条件が含まれるか（文字列レベルの静的確認）
def_c AS (
  SELECT jsonb_build_object(
    'uses_owned_by_current_user', pg_get_functiondef(p.oid) ILIKE '%hossii_is_owned_by_current_user%',
    'uses_can_access_space',      pg_get_functiondef(p.oid) ILIKE '%can_access_space%',
    'excludes_deleted',           pg_get_functiondef(p.oid) ILIKE '%deleted_at IS NULL%',
    'excludes_hidden',            pg_get_functiondef(p.oid) ILIKE '%is_hidden%',
    'no_author_id_fallback',      pg_get_functiondef(p.oid) NOT ILIKE '%author_id%'
  ) AS d
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_my_space_activity'
)
SELECT ord, section, data FROM (
  SELECT 1 AS ord, '01_props'  AS section, (SELECT d FROM props_c)  AS data
  UNION ALL SELECT 2, '02_grants', (SELECT d FROM grants_c)
  UNION ALL SELECT 3, '03_definition', (SELECT d FROM def_c)
) s ORDER BY ord;

-- ----------------------------------------------------------------------------
-- 4) 本人性の実データ検証（開発の実ユーザー JWT で SQL Editor / アプリから実行）:
--    SELECT public.get_my_space_activity('<自分が投稿した space_id>');
--      → post_count が全 Pane・全ページ合計と一致すること
--      → recent に自分の投稿のみ（最大 3 件）が返ること
--    SELECT public.get_my_space_activity('<自分が投稿していない space_id>');
--      → post_count = 0, recent = []
--    anon（未ログイン）では EXECUTE 不可（grants_c.anon = false）。
-- ----------------------------------------------------------------------------
