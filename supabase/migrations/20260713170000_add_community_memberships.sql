-- ============================================================================
-- add_community_memberships  (Phase 2: コミュニティ所属データモデル)
-- ----------------------------------------------------------------------------
-- 目的:
--   ログインアカウント（auth.users）とコミュニティ（communities）の正式な所属関係を
--   保存する DB 基盤。個人スペース（Phase 3）の「active community member」判定と、
--   将来の招待制・複数コミュニティ所属の土台。
--
-- 本 migration の範囲（Phase 2）:
--   - community_memberships テーブル + 制約 + index + updated_at trigger
--   - RLS（本人 SELECT / コミュニティ管理者・super_admin の SELECT/UPDATE/DELETE）
--   - 既存管理者を (role='admin', status='active') として backfill
--   - 管理者用メンバー追加 RPC admin_add_community_member（SECURITY DEFINER）
--   - 本人の所属一覧 RPC list_my_community_memberships（community 名を安全に同梱）
--
-- 非対象（別 Phase）:
--   個人スペース（Phase 3）/ invite_only（Phase 5）/ メール招待・本人承認（Phase 6）/
--   個人発行・仮発行（101）。community_membership.role は所属の記録であり、
--   権限判定の正本は当面 communities.admin_id / JWT super_admin のまま（109 §8.2）。
--
-- 命名慣習:
--   109 §8.1 の DB 案は user_id 表記だが、既存 space_memberships /
--   hossii_authorships / space_participant_accounts に合わせ auth_user_id（uuid →
--   auth.users）とする。community_id は communities(id)（uuid）を参照する。
--
-- 安全性:
--   - 冪等（IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS / ON CONFLICT）。
--   - destructive な DROP TABLE / DELETE / TRUNCATE を含まない。
--   - 一般ユーザは role/status を自己付与・自己昇格できない（直接 INSERT policy 無し。
--     作成は管理者専用 RPC のみ）。
--   - development のみ適用。production 未操作。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_memberships (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id   uuid        NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  auth_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text        NOT NULL DEFAULT 'member'
                             CHECK (role IN ('admin', 'member')),
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  invited_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at     timestamptz,
  accepted_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, auth_user_id)
);

-- ---------------------------------------------------------------------------
-- 2. index（本人の所属一覧 / コミュニティ単位の所属一覧）
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS community_memberships_auth_user_idx
  ON public.community_memberships (auth_user_id);
CREATE INDEX IF NOT EXISTS community_memberships_community_idx
  ON public.community_memberships (community_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_memberships_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_memberships_set_updated_at ON public.community_memberships;
CREATE TRIGGER community_memberships_set_updated_at
  BEFORE UPDATE ON public.community_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.community_memberships_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS
--    SELECT: 本人 / 当該コミュニティ管理者（communities.admin_id）/ super_admin
--    UPDATE/DELETE: コミュニティ管理者・super_admin のみ（一般ユーザ不可＝自己昇格不可）
--    INSERT: policy を与えない（作成は RPC のみ）
-- ---------------------------------------------------------------------------
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_memberships_select_own ON public.community_memberships;
CREATE POLICY community_memberships_select_own
  ON public.community_memberships
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS community_memberships_select_community_admin ON public.community_memberships;
CREATE POLICY community_memberships_select_community_admin
  ON public.community_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = community_memberships.community_id
        AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS community_memberships_select_super_admin ON public.community_memberships;
CREATE POLICY community_memberships_select_super_admin
  ON public.community_memberships
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS community_memberships_admin_update ON public.community_memberships;
CREATE POLICY community_memberships_admin_update
  ON public.community_memberships
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = community_memberships.community_id
        AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS community_memberships_admin_delete ON public.community_memberships;
CREATE POLICY community_memberships_admin_delete
  ON public.community_memberships
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = community_memberships.community_id
        AND c.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. table grants
--    anon=なし。authenticated=SELECT / UPDATE / DELETE（RLS でゲート）。
--    INSERT は付与しない＝直接 INSERT で role/status を自己付与できない。
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.community_memberships FROM anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.community_memberships TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. backfill: 既存コミュニティ管理者を (role='admin', status='active') として登録
--    権限源は当面 communities.admin_id（membership は所属の記録）。冪等。
-- ---------------------------------------------------------------------------
INSERT INTO public.community_memberships (community_id, auth_user_id, role, status, accepted_at)
SELECT c.id, c.admin_id, 'admin', 'active', now()
FROM public.communities c
WHERE c.admin_id IS NOT NULL
ON CONFLICT (community_id, auth_user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. RPC: コミュニティ管理者が個人をメンバーとして追加する
--    - 呼び出し者は当該コミュニティ管理者（communities.admin_id）または super_admin のみ。
--    - 初版は「追加時点で active」（109 §8.3）。本人承認フローは Phase 6。
--    - role は 'admin' | 'member' のみ。既定 'member'。
--    - 冪等: 既存の (community_id, auth_user_id) は status/role を維持し updated_at のみ更新。
--    - auth_user_id は引数で受け取る（管理者が対象メンバーを指定するため）。呼び出し者本人性は
--      auth.uid() を正本に管理者権限を検証する（引数で管理者になりすませない）。
--    - anon には EXECUTE を付与しない。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_community_member(
  p_community_id uuid,
  p_auth_user_id uuid,
  p_role         text DEFAULT 'member'
)
RETURNS public.community_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  -- COALESCE で NULL を false に落とす。role が無い一般ユーザで NULL のまま OR/NOT に
  -- 渡すと `NOT (NULL OR false) = NULL` となり IF が発火せず権限チェックが素通り（fail-open）
  -- するため、必ず false へ確定させる（20260713150000 と同じ対策）。
  v_is_super boolean := COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false);
  v_row public.community_memberships;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  IF NOT (
    v_is_super
    OR EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = p_community_id AND c.admin_id = v_uid
    )
  ) THEN
    RAISE EXCEPTION 'not authorized to manage this community';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id) THEN
    RAISE EXCEPTION 'target user not found';
  END IF;

  INSERT INTO public.community_memberships
    (community_id, auth_user_id, role, status, invited_by, accepted_at)
  VALUES
    (p_community_id, p_auth_user_id, p_role, 'active', v_uid, now())
  ON CONFLICT (community_id, auth_user_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_community_member(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_add_community_member(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_add_community_member(uuid, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC: ログイン本人の community 所属一覧（community 名を安全に同梱）
--    communities は public read ではない（owner/super_admin のみ SELECT 可）ため、
--    一般メンバーが自分の所属コミュニティ名を得るための SECURITY DEFINER 経路を用意する。
--    返却は表示に必要な最小情報のみ（admin_id / PII を含めない）。本人の行だけを返す。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_community_memberships()
RETURNS TABLE (
  community_id   uuid,
  community_name text,
  role           text,
  status         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cm.community_id, c.name AS community_name, cm.role, cm.status
  FROM public.community_memberships cm
  JOIN public.communities c ON c.id = cm.community_id
  WHERE cm.auth_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.list_my_community_memberships() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_community_memberships() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_community_memberships() TO authenticated;
