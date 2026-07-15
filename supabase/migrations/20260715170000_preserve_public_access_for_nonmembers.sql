-- ============================================================================
-- preserve_public_access_for_nonmembers  (Phase 6 リリース候補監査 修正)
-- ----------------------------------------------------------------------------
-- 問題:
--   20260715120000_bind_community_membership_access.sql が can_access_space の
--   「public shared」分岐に community membership ゲート
--   (can_access_community_content) を誤って適用していた。
--   その結果、community_id を持つ public shared space に対し、
--     - authenticated だが community 非所属のユーザ
--     - suspended / removed の community member
--   が誤ってアクセス不可になっていた（Phase 5 の public 回帰を破壊）。
--   development の public shared space は全て community_id を持つため影響は全件。
--
-- 正式仕様（109 / 本監査）:
--   public shared は membership 状態より先に public として許可する。
--   guest / anon / authenticated 非所属 / active member / suspended / removed
--   すべてが public 利用者としてアクセスできる。
--   community status gate は personal / invite_only にのみ適用する。
--
-- 変更点（この分岐のみ）:
--   - personal:    owner は active community member 必須（admin / super_admin 例外）→ 維持
--   - public shared: community gate を撤去し全員許可 → 修正
--   - invite_only: active space member + community gate（admin / super_admin 例外）→ 維持
--
-- 安全性: CREATE OR REPLACE のみ。append-only。destructive DML なし。development のみ。
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
        -- shared + public: public を最優先。membership 状態に関係なく全員許可。
        -- guest / anon / authenticated 非所属 / active / suspended / removed すべて可。
        (
          s.space_type = 'shared'
          AND COALESCE(s.access_mode, 'public') = 'public'
        )
        OR
        -- shared + invite_only: active space member + active community member
        -- （所属管理者 / super_admin は例外）。suspended/removed は community gate で遮断。
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
