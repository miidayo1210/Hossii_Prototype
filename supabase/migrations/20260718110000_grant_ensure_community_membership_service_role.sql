-- ============================================================================
-- grant_ensure_community_membership_service_role  (115: Edge Function 用)
-- ----------------------------------------------------------------------------
-- ensure_community_membership_for_space_member は authenticated へ公開せず、
-- service role（issue-participant-account Edge Function）からのみ呼べるようにする。
-- append-only。function 本体は変更しない。
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.ensure_community_membership_for_space_member(text, uuid)
  TO service_role;
