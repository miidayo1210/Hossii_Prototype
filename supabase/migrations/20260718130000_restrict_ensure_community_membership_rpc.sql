-- ============================================================================
-- restrict_ensure_community_membership_rpc  (115: RPC 実行権限の明示的限定)
-- ----------------------------------------------------------------------------
-- ensure_community_membership_for_space_member を service_role のみ実行可能にする。
-- PostgREST 経由の anon / authenticated 呼び出しを拒否する。
-- append-only。function 本体は変更しない。
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.ensure_community_membership_for_space_member(text, uuid)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.ensure_community_membership_for_space_member(text, uuid)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.ensure_community_membership_for_space_member(text, uuid)
  FROM authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_community_membership_for_space_member(text, uuid)
  TO service_role;
