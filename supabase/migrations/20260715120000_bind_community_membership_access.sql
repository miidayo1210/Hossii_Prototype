-- ============================================================================
-- bind_community_membership_access  (Phase 6: suspended/removed のアクセス遮断)
-- ----------------------------------------------------------------------------
-- 目的:
--   can_access_space を拡張し、authenticated ユーザの community membership
--   status（active のみ）をゲートに加える。guest（anon）は public 回帰を維持。
--   personal space の owner も active membership が必要（管理者・super_admin は例外）。
--
-- 安全性: CREATE OR REPLACE のみ。development のみ。
-- ============================================================================

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
        -- personal: owner は active community member のみ（admin/super_admin は可）
        (
          s.space_type = 'personal'
          AND (
            (
              s.owner_user_id = auth.uid()
              AND s.status = 'active'
              AND (
                s.community_id IS NULL
                OR public.can_access_community_content(s.community_id)
              )
            )
            OR EXISTS (
              SELECT 1 FROM public.communities c
              WHERE c.id = s.community_id AND c.admin_id = auth.uid()
            )
            OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
          )
        )
        OR
        -- shared + public: guest 可。authenticated は active community member のみ。
        (
          s.space_type = 'shared'
          AND COALESCE(s.access_mode, 'public') = 'public'
          AND (
            auth.uid() IS NULL
            OR s.community_id IS NULL
            OR public.can_access_community_content(s.community_id)
          )
        )
        OR
        -- shared + invite_only: active space member + active community member
        (
          s.space_type = 'shared'
          AND s.access_mode = 'invite_only'
          AND (
            s.community_id IS NULL
            OR public.can_access_community_content(s.community_id)
          )
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
