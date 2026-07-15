-- ============================================================================
-- add_space_memberships  (Phase 2A: スペース所属データモデルの基盤)
-- ----------------------------------------------------------------------------
-- 目的:
--   ログインアカウント（auth.users）と共有スペースの正式な所属関係を保存する
--   最小の DB 基盤を用意する。将来のアカウントページ参加スペース一覧・スペース
--   ごとのニックネーム・招待制スペース・個人スペースの土台。
--
-- 本 migration の範囲（Phase 2A）:
--   - space_memberships テーブル + 制約 + index
--   - RLS（本人 SELECT / スペース管理者・super_admin の管理）
--   - 安全な membership 作成 RPC join_space_as_member（SECURITY DEFINER）
--
-- 非対象（別 Phase）:
--   community_memberships / 個人スペース / invite_only / access_mode /
--   既存管理者権限の membership への移行 / ゲスト membership /
--   既存ユーザーの backfill。
--
-- 既存モデルとの整合:
--   - spaces.id は text のため space_id は text。
--   - 認証ユーザ参照列名は既存 hossii_authorships / space_participant_accounts に
--     合わせ auth_user_id（uuid → auth.users）とする（109 §13.1 の DB 案は user_id
--     表記だが、実テーブルの命名慣習を優先）。
--   - 管理者権限の正本は当面 communities.admin_id / JWT super_admin のまま。
--     membership.role は所属の記録・将来移行用の補助情報であり、権限判定は置換しない。
--
-- 安全性:
--   - 冪等（IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS）。
--   - 既存 spaces / users / profiles / authorship を変更しない（DDL は新規のみ）。
--   - destructive な DROP TABLE / DELETE / UPDATE / TRUNCATE を含まない。
--   - 一般ユーザは role/status を自己付与・自己昇格できない（直接 INSERT/UPDATE の
--     policy を与えず、作成は role='member' 固定の RPC のみ）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_memberships (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id       text        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  auth_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text        NOT NULL DEFAULT 'member'
                             CHECK (role IN ('owner', 'admin', 'member')),
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  space_nickname text,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, auth_user_id)
);

-- ---------------------------------------------------------------------------
-- 2. index（自分の所属一覧 / スペース単位の所属一覧）
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS space_memberships_auth_user_idx
  ON public.space_memberships (auth_user_id);
CREATE INDEX IF NOT EXISTS space_memberships_space_idx
  ON public.space_memberships (space_id);

-- ---------------------------------------------------------------------------
-- 3. updated_at 自動更新トリガ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.space_memberships_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS space_memberships_set_updated_at ON public.space_memberships;
CREATE TRIGGER space_memberships_set_updated_at
  BEFORE UPDATE ON public.space_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.space_memberships_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RLS enable
-- ---------------------------------------------------------------------------
ALTER TABLE public.space_memberships ENABLE ROW LEVEL SECURITY;

-- SELECT: 本人 / 当該スペースのコミュニティ管理者 / super_admin
DROP POLICY IF EXISTS space_memberships_select_own ON public.space_memberships;
CREATE POLICY space_memberships_select_own
  ON public.space_memberships
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS space_memberships_select_space_admin ON public.space_memberships;
CREATE POLICY space_memberships_select_space_admin
  ON public.space_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_memberships.space_id
        AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS space_memberships_select_super_admin ON public.space_memberships;
CREATE POLICY space_memberships_select_super_admin
  ON public.space_memberships
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- UPDATE / DELETE: スペース管理者・super_admin のみ（一般ユーザは不可＝自己昇格不可）
-- 一般ユーザには INSERT/UPDATE/DELETE policy を一切与えない。作成は RPC 経由のみ。
DROP POLICY IF EXISTS space_memberships_admin_update ON public.space_memberships;
CREATE POLICY space_memberships_admin_update
  ON public.space_memberships
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_memberships.space_id
        AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS space_memberships_admin_delete ON public.space_memberships;
CREATE POLICY space_memberships_admin_delete
  ON public.space_memberships
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_memberships.space_id
        AND c.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. table grants 正規化
--    anon=なし。
--    authenticated=SELECT / UPDATE / DELETE（それぞれ上の RLS policy でゲート）。
--      - INSERT は付与しない＝直接 INSERT で role/status を自己付与できない。
--        作成は role='member' 固定の RPC join_space_as_member のみ。
--      - UPDATE/DELETE は policy 上「スペース管理者・super_admin」に限定されるため、
--        一般ユーザは自分・他人いずれの行も変更・削除できない。
--    service_role・postgres は既存維持（RLS を bypass して管理可能）。
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.space_memberships FROM anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.space_memberships TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC: ログインユーザを当該スペースの member として安全に登録する
--    - auth.uid() を使用（クライアント引数で他人になりすませない）。
--    - role='member' / status='active' 固定（自己昇格不可）。
--    - ON CONFLICT で冪等（再訪問しても重複せず、既存 role/status は変更しない）。
--    - anon（ゲスト）には EXECUTE を付与しないため作成不可。
--    - SECURITY DEFINER / search_path='' （全て schema 修飾）。
-- ---------------------------------------------------------------------------
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'join_space_as_member: not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = p_space_id) THEN
    RAISE EXCEPTION 'join_space_as_member: space % not found', p_space_id;
  END IF;

  INSERT INTO public.space_memberships (space_id, auth_user_id, role, status, space_nickname)
  VALUES (p_space_id, v_uid, 'member', 'active', p_space_nickname)
  ON CONFLICT (space_id, auth_user_id) DO UPDATE
    SET updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- EXECUTE は authenticated のみ（anon=ゲストは作成不可）
REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_space_as_member(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_space_as_member(text, text) TO authenticated;
