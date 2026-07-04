-- ============================================================
-- 101: 管理者発行参加者アカウント
-- スペースごと最大 20 スロットの参加 ID / パスワード管理
-- ============================================================

CREATE TABLE IF NOT EXISTS space_participant_accounts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       TEXT        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  slot_number    INT         NOT NULL CHECK (slot_number BETWEEN 1 AND 20),
  login_id       TEXT        NOT NULL,
  auth_user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_email     TEXT        NOT NULL UNIQUE,
  status         TEXT        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'revoked')),
  first_login_at TIMESTAMPTZ,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by      UUID        REFERENCES auth.users(id),
  UNIQUE (space_id, slot_number),
  UNIQUE (space_id, login_id)
);

CREATE INDEX IF NOT EXISTS space_participant_accounts_space_id_idx
  ON space_participant_accounts (space_id);

ALTER TABLE space_participant_accounts ENABLE ROW LEVEL SECURITY;

-- コミュニティ管理者: 自コミュニティ配下スペースの発行アカウントのみ SELECT
CREATE POLICY "admin read space_participant_accounts"
  ON space_participant_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM spaces s
      JOIN communities c ON c.id = s.community_id
      WHERE s.id = space_participant_accounts.space_id
        AND c.admin_id = auth.uid()
    )
  );

-- スーパー管理者: 全件 SELECT
CREATE POLICY "super_admin read space_participant_accounts"
  ON space_participant_accounts
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- INSERT/UPDATE/DELETE は Edge Function (service role) 経由のみ
-- Edge Function デプロイ: supabase functions deploy issue-participant-account

-- ============================================================
-- RPC: 参加 ID → 内部 auth メール解決（ログイン用）
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_participant_login(
  p_space_id TEXT,
  p_login_id TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth_email
  FROM space_participant_accounts
  WHERE space_id = p_space_id
    AND login_id = lower(trim(p_login_id))
    AND status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION resolve_participant_login(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- RPC: 初回ログイン日時を記録
-- ============================================================
CREATE OR REPLACE FUNCTION mark_participant_first_login(p_auth_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE space_participant_accounts
  SET first_login_at = now()
  WHERE auth_user_id = p_auth_user_id
    AND first_login_at IS NULL
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION mark_participant_first_login(UUID) TO authenticated;
