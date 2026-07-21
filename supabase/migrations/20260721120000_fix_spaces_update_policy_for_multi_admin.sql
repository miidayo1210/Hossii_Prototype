-- ============================================================================
-- fix_spaces_update_policy_for_multi_admin  (123 Phase 6D blocker)
-- ----------------------------------------------------------------------------
-- Cause:
--   spaces_update_own (since 20260301000002) used a scalar subquery:
--     community_id = (SELECT id FROM communities WHERE admin_id = auth.uid())
--   When auth.uid() administers multiple communities, the subquery returns
--   more than one row → SQLSTATE 21000 on any spaces UPDATE (participation_mode,
--   is_private, description, etc.).
--
-- Fix:
--   Correlate the row being updated with its community via EXISTS so multi-
--   community admins can update spaces in each community they own, but not others.
--
-- Scope:
--   spaces_update_own only. super_admin policy unchanged. SELECT/INSERT/DELETE
--   policies unchanged (insert_own/delete_own still use the old scalar pattern;
--   track separately if needed).
-- ============================================================================

DROP POLICY IF EXISTS "spaces_update_own" ON public.spaces;

CREATE POLICY "spaces_update_own" ON public.spaces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = spaces.community_id
        AND c.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = spaces.community_id
        AND c.admin_id = auth.uid()
    )
  );

COMMENT ON POLICY "spaces_update_own" ON public.spaces IS
  'Community admin may UPDATE shared/personal spaces in communities they administer. '
  'Uses EXISTS (not scalar subquery) so users who admin multiple communities do not hit SQLSTATE 21000.';
