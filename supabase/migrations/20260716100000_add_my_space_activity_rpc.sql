-- ============================================================================
-- add_my_space_activity_rpc  (My Hossii: 本人の個人ログをスペース全体で正確に集計)
-- ----------------------------------------------------------------------------
-- 背景:
--   My Hossii の個人ログはこれまでクライアントのロード済み投稿（materializeHossiisArray）
--   だけを集計していた。ページングで未取得の投稿や、現在表示中でない別 Pane の投稿が
--   反映されず、件数・直近ログ・状態表示が不正確になり得た。
--
-- 目的:
--   指定スペース内の「ログイン本人の投稿」について、DB/RLS 側で正確な件数と
--   直近ログ（最大 3 件）を返す最小 read-only RPC を用意する。
--
-- 本人性（正本）:
--   hossii_authorships.auth_user_id = auth.uid()（既存 helper
--   hossii_is_owned_by_current_user を再利用）。author_id へは fallback しない。
--   → ゲスト投稿（authorship に auth_user_id 行を持たない）は本人分に含まれない。
--
-- 集計対象 / 除外:
--   - 指定 space 内の全 Pane（space_pane で絞らない）
--   - deleted_at IS NULL（ソフト削除は除外。物理 DELETE はしない）
--   - COALESCE(is_hidden, false) = false（管理者による非表示投稿を除外）
--   - visibility は public / owner_only とも本人分は含める（本人は自分の owner_only を見られる）
--   - can_access_space(space_id) と整合（アクセス不可スペースでは空を返す）
--   - 他スペースは p_space_id 一致で自然に除外
--   - 他人の投稿は hossii_is_owned_by_current_user で除外
--
-- 返却（必要最小限。他人の情報・UUID・PII は返さない）:
--   jsonb {
--     "post_count": <int>,                       -- 本人投稿の総数（全 Pane・全ページ）
--     "recent": [ { id, message, created_at, emotion } ... ]  -- 直近最大 3 件
--   }
--   ※ author_id / auth_user_id / email / nickname 等の identity は返さない。
--   ※ Pane 名/ID は現在の UI（本人アバターの直近ログ表示）で不要なため返さない。
--   ※ recent の message は本人自身の投稿本文のみ（他人分は決して含まれない）。
--
-- セキュリティ:
--   - SECURITY DEFINER / SET search_path = ''（全オブジェクト schema 完全修飾）
--   - auth.uid() が正本。引数で uid/role を受け取らない（なりすまし不可）
--   - authenticated のみ EXECUTE。anon には付与しない（auth.uid()=NULL で常に 0 件だが、
--     明示的に anon の EXECUTE を剥奪して露出面を減らす）
--
-- 安全性: read-only（SELECT のみ）。既存テーブル・RLS・grants を変更しない。
--         冪等（CREATE OR REPLACE / GRANT 正規化）。destructive DML なし。
--         append-only migration。development のみ適用。production 未操作。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_space_activity(p_space_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH mine AS (
    SELECT
      h.id,
      h.message,
      h.created_at,
      h.emotion
    FROM public.hossiis h
    WHERE h.space_id = p_space_id
      AND h.deleted_at IS NULL
      AND COALESCE(h.is_hidden, false) = false
      AND public.can_access_space(h.space_id)
      AND public.hossii_is_owned_by_current_user(h.id)
  )
  SELECT jsonb_build_object(
    'post_count', (SELECT count(*)::int FROM mine),
    'recent', COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', t.id,
                   'message', t.message,
                   'created_at', t.created_at,
                   'emotion', t.emotion
                 )
                 ORDER BY t.created_at DESC
               )
        FROM (
          SELECT id, message, created_at, emotion
          FROM mine
          ORDER BY created_at DESC
          LIMIT 3
        ) t
      ),
      '[]'::jsonb
    )
  );
$$;

-- authenticated のみ。anon には EXECUTE を与えない（本人性は auth.uid() が正本）。
REVOKE ALL ON FUNCTION public.get_my_space_activity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_space_activity(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_space_activity(text) TO authenticated;
