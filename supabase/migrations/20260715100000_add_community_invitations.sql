-- ============================================================================
-- add_community_invitations  (Phase 6: 招待基盤 + audit + community nickname)
-- ----------------------------------------------------------------------------
-- 目的（109 §Phase 6）:
--   安全なコミュニティ招待（token hash のみ保存）、監査ログ、
--   community_memberships.community_nickname、communities.description。
--
-- 安全性: 冪等。raw token は DB に保存しない。development のみ。
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. communities.description（HOME 用の目的・説明）
-- ---------------------------------------------------------------------------
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS description text;

-- ---------------------------------------------------------------------------
-- 2. community_memberships.community_nickname（コミュニティごとの表示名）
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_memberships
  ADD COLUMN IF NOT EXISTS community_nickname text;

-- ---------------------------------------------------------------------------
-- 3. community_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    uuid        NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  invitee_email   text        NOT NULL,
  role            text        NOT NULL DEFAULT 'member'
                              CHECK (role IN ('admin', 'member')),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  token_hash      text        NOT NULL,
  expires_at      timestamptz NOT NULL,
  invited_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  accepted_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS community_invitations_token_hash_uidx
  ON public.community_invitations (token_hash);
CREATE INDEX IF NOT EXISTS community_invitations_community_idx
  ON public.community_invitations (community_id);
CREATE INDEX IF NOT EXISTS community_invitations_email_idx
  ON public.community_invitations (community_id, lower(invitee_email));

-- ---------------------------------------------------------------------------
-- 4. community_audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_audit_logs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          uuid        NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  action                text        NOT NULL
                                    CHECK (action IN (
                                      'invitation_created',
                                      'invitation_accepted',
                                      'invitation_revoked',
                                      'membership_suspended',
                                      'membership_reactivated',
                                      'membership_removed'
                                    )),
  actor_auth_user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  target_auth_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  target_invitation_id  uuid        REFERENCES public.community_invitations(id) ON DELETE SET NULL,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_audit_logs_community_idx
  ON public.community_audit_logs (community_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. RLS: community_invitations（管理者 / super_admin のみ）
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_invitations_admin_select ON public.community_invitations;
CREATE POLICY community_invitations_admin_select
  ON public.community_invitations
  FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_invitations.community_id AND c.admin_id = auth.uid()
    )
  );

-- INSERT/UPDATE は RPC のみ（直接書き込み不可）
REVOKE ALL ON public.community_invitations FROM anon, authenticated;
GRANT SELECT ON public.community_invitations TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS: community_audit_logs（管理者 / super_admin のみ SELECT）
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_audit_logs_admin_select ON public.community_audit_logs;
CREATE POLICY community_audit_logs_admin_select
  ON public.community_audit_logs
  FOR SELECT TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_audit_logs.community_id AND c.admin_id = auth.uid()
    )
  );

REVOKE ALL ON public.community_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.community_audit_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. 内部: 監査ログ記録ヘルパ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._community_audit_log(
  p_community_id         uuid,
  p_action               text,
  p_actor_auth_user_id   uuid,
  p_target_auth_user_id  uuid DEFAULT NULL,
  p_target_invitation_id uuid DEFAULT NULL,
  p_metadata             jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.community_audit_logs (
    community_id, action, actor_auth_user_id,
    target_auth_user_id, target_invitation_id, metadata
  ) VALUES (
    p_community_id, p_action, p_actor_auth_user_id,
    p_target_auth_user_id, p_target_invitation_id, COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._community_audit_log(uuid, text, uuid, uuid, uuid, jsonb) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 8. 内部: コミュニティ管理者判定
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_community_admin(p_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = p_community_id AND c.admin_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_community_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_community_admin(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. コミュニティコンテンツへのアクセス（active member / admin / super_admin）
--    選択 community は権限正本にしない。membership.status を正本とする。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_community_content(p_community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = p_community_id AND c.admin_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.community_memberships cm
      WHERE cm.community_id = p_community_id
        AND cm.auth_user_id = auth.uid()
        AND cm.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_community_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_community_content(uuid) TO authenticated;
