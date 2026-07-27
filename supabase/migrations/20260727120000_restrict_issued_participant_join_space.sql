-- ============================================================
-- restrict_issued_participant_join_space
--
-- 参加 ID が join_space_as_member を直接呼んでも、発行元以外の
-- public space へ space_memberships を作れないようにする（Task 2）。
--
-- 正本:
--   auth.uid()
--   → public.space_participant_accounts (status = 'active')
--   → space_id（発行元）
--
-- クライアントから渡した scope / isIssuedParticipant は信用しない。
-- 投稿・nickname・cleanup は対象外。
-- ============================================================

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
  v_active_count integer;
  v_issuing_space_id text;
  v_has_any_participant_row boolean;
  v_meta_participant boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'join_space_as_member: not authenticated';
  END IF;

  -- JWT app_metadata.participant（jsonb boolean / 文字列の両方を許容）。DB 行と併用し、
  -- metadata だけの壊れた参加 ID を通常アカウントへ fallback させない。
  v_meta_participant :=
    COALESCE((auth.jwt() -> 'app_metadata' -> 'participant') = 'true'::jsonb, false)
    OR lower(COALESCE(auth.jwt() -> 'app_metadata' ->> 'participant', '')) = 'true';

  SELECT count(*)::integer
  INTO v_active_count
  FROM public.space_participant_accounts spa
  WHERE spa.auth_user_id = v_uid
    AND spa.status = 'active';

  SELECT EXISTS (
    SELECT 1
    FROM public.space_participant_accounts spa
    WHERE spa.auth_user_id = v_uid
  )
  INTO v_has_any_participant_row;

  IF v_active_count > 1 THEN
    RAISE EXCEPTION 'issued_participant_scope_ambiguous'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_active_count = 0 THEN
    -- metadata あり / revoked のみ / 行不整合 → 通常アカウント経路へ fallback しない
    IF v_meta_participant OR v_has_any_participant_row THEN
      RAISE EXCEPTION 'issued_participant_scope_unavailable'
        USING ERRCODE = 'P0001';
    END IF;
    -- 通常アカウント: 既存の public shared ゲートへ進む
  ELSE
    -- active 1 件（metadata 欠落でも spa 行を正本として参加 ID 扱い）
    SELECT spa.space_id
    INTO v_issuing_space_id
    FROM public.space_participant_accounts spa
    WHERE spa.auth_user_id = v_uid
      AND spa.status = 'active'
    LIMIT 1;

    IF v_issuing_space_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.spaces s WHERE s.id = v_issuing_space_id
       ) THEN
      RAISE EXCEPTION 'issued_participant_issuing_space_missing'
        USING ERRCODE = 'P0001';
    END IF;

    IF p_space_id IS DISTINCT FROM v_issuing_space_id THEN
      RAISE EXCEPTION 'issued_participant_cross_space_join_forbidden'
        USING ERRCODE = 'P0001';
    END IF;
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

  BEGIN
    PERFORM public.ensure_community_membership_for_space_member(p_space_id, v_uid);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'ensure_community_membership_for_space_member failed for space=% user=%: %',
        p_space_id, v_uid, SQLERRM;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_space_as_member(text, text) TO authenticated;
