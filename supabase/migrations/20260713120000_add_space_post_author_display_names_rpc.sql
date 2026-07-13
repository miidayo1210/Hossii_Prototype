-- ============================================================================
-- add_space_post_author_display_names_rpc  (Phase 2C: 投稿者の現在名の安全な解決)
-- ----------------------------------------------------------------------------
-- 目的:
--   過去投稿に「投稿時の名前（hossiis.author_name のスナップショット）」だけでなく
--   「投稿者アカウントの現在のスペースニックネーム」も表示できるよう、投稿 ID →
--   現在表示名の対応を安全に返す read-only RPC を用意する。
--
-- 返す最小情報（クライアントへ返してよいもの）:
--   - hossii_id             : 投稿 ID（既に anon にも公開されている hossiis.id）
--   - current_space_nickname: 当該スペースでの現在ニックネーム
--   ※ auth_user_id / email / user UUID / 認証 metadata / role / status は一切返さない。
--
-- 結合条件（他人の投稿の現在名解決に必要。RLS 直読みでは他人分を取れないため
--            SECURITY DEFINER で結合する）:
--   hossiis.id                    = hossii_authorships.hossii_id
--   hossiis.space_id              = space_memberships.space_id
--   hossii_authorships.auth_user_id = space_memberships.auth_user_id
--   AND hossiis.space_id = p_space_id           （他スペースのデータを混ぜない）
--   AND space_nickname が非 NULL・非空          （無ければ行を返さず、client は投稿時名へ fallback）
--
-- anon 公開の妥当性:
--   現行の hossiis SELECT RLS は `using (true)`（20260223000000 initial schema）で、
--   anon/authenticated ともに全スペースの投稿と author_name を閲覧できる。したがって
--   「投稿 ID + 公開ニックネーム」だけを返す本 RPC を anon にも許可することは、現在の
--   閲覧仕様と整合する（PII は返さない）。将来 invite_only / 非公開スペースの read 制限を
--   実装する際は、本 RPC の公開範囲も併せて見直すこと（今回は未実装権限を先取りしない）。
--
-- 安全性:
--   - read-only（SELECT のみ）。既存テーブル・RLS・grants を変更しない。
--   - 冪等（CREATE OR REPLACE / DROP ... IF EXISTS 相当の GRANT 正規化）。
--   - SECURITY DEFINER / SET search_path = ''（全オブジェクト schema 修飾）。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fetch_space_post_author_display_names(
  p_space_id text
)
RETURNS TABLE (
  hossii_id             text,
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
  WHERE h.space_id = p_space_id
    AND m.space_nickname IS NOT NULL
    AND btrim(m.space_nickname) <> '';
$$;

-- EXECUTE は anon / authenticated の双方に許可（現行 hossiis 閲覧仕様と整合）。
-- PII は返さないため anon 公開でも安全。
REVOKE ALL ON FUNCTION public.fetch_space_post_author_display_names(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_space_post_author_display_names(text) TO anon, authenticated;
