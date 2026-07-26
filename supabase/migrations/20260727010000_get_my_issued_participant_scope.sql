-- ============================================================
-- get_my_issued_participant_scope
--
-- 参加 ID アカウントの Account 所属表示用。
-- auth.uid() に紐づく active な space_participant_accounts 1 件から
-- 発行元 space / community の表示用最小情報を返す。
--
-- 背景:
--   communities は client 直 SELECT 不可（owner / super_admin 等のみ）。
--   参加 ID 本人が発行元 community 名/slug を得るには DEFINER RPC が必要。
--
-- 方針:
--   - 引数なし（auth.uid() のみ）。任意の auth_user_id は受け取らない
--   - active 0 件 → 空
--   - active 1 件 → scope 1 行
--   - active 2 件以上 → ambiguous_issued_participant_scope 例外（推測して 1 件返さない）
--   - auth_email / login_id / auth_user_id / パスワード系は返さない
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_issued_participant_scope()
RETURNS TABLE (
  space_id          text,
  space_name        text,
  space_url         text,
  is_archived       boolean,
  community_id      uuid,
  community_name    text,
  community_slug    text,
  space_nickname    text,
  membership_id     uuid,
  joined_at         timestamptz,
  issued_at         timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
  INTO v_count
  FROM public.space_participant_accounts spa
  WHERE spa.auth_user_id = v_uid
    AND spa.status = 'active';

  IF v_count = 0 THEN
    RETURN;
  END IF;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'ambiguous_issued_participant_scope'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS space_id,
    s.name AS space_name,
    s.space_url AS space_url,
    COALESCE(s.is_archived, false) AS is_archived,
    c.id AS community_id,
    c.name AS community_name,
    c.slug AS community_slug,
    sm.space_nickname AS space_nickname,
    sm.id AS membership_id,
    sm.joined_at AS joined_at,
    spa.issued_at AS issued_at
  FROM public.space_participant_accounts spa
  INNER JOIN public.spaces s
    ON s.id = spa.space_id
  INNER JOIN public.communities c
    ON c.id = s.community_id
  LEFT JOIN public.space_memberships sm
    ON sm.space_id = spa.space_id
   AND sm.auth_user_id = v_uid
  WHERE spa.auth_user_id = v_uid
    AND spa.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_issued_participant_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_issued_participant_scope() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_issued_participant_scope() TO authenticated;
