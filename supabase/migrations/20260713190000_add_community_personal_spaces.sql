-- ============================================================================
-- add_community_personal_spaces  (Phase 3: コミュニティ内個人スペース)
-- ----------------------------------------------------------------------------
-- 目的（109 §10 / §17）:
--   特定コミュニティの目的に沿った「その人専用のスペース」を提供する。
--   AccountScreen / MyLogs / My Hossii（＝Hossii 全体の個人領域）とは別物で、
--   community に属する実際の spaces（space_type='personal'）である。
--
-- 本 migration の範囲（Phase 3）:
--   - spaces 拡張: space_type / owner_user_id / status + 制約 + 部分 UNIQUE。
--   - can_access_space(space_id) を personal 対応へ CREATE OR REPLACE（Phase 2.5 の seam）。
--   - spaces / hossiis / space_panes の SELECT を helper に束ね、personal を秘匿。
--   - ensure_my_personal_space(p_community_id): active member のみ・冪等な作成 RPC。
--   - list_my_community_personal_spaces(): 本人の active community と個人スペース有無。
--
-- アクセス設計（§10.2 / §10.3 / §15.2 / §17.1 の確定仕様）:
--   閲覧(SELECT)可能: owner 本人 / 所属コミュニティ管理者 / super_admin のみ。
--   不可: 他の一般メンバー・他コミュニティ管理者・ゲスト・URL 直叩き。
--   管理者は閲覧・投稿はできるが本人投稿の編集/削除は不可（既存 authorship 基盤で担保）。
--   owner_only 投稿は personal スペース内でも投稿本人だけに見える（visibility を維持）。
--   ＝「管理者だから無条件で読める」ではなく、所属コミュニティに限定＋本人へ明示（UI）。
--
-- 安全性: 冪等（IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS / ON CONFLICT）。
--         destructive DML なし。development のみ。production 未操作。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. spaces 拡張
-- ---------------------------------------------------------------------------
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS space_type text NOT NULL DEFAULT 'shared';
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_space_type_check;
ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_space_type_check CHECK (space_type IN ('shared', 'personal'));

ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS owner_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_status_check;
ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_status_check CHECK (status IN ('active', 'suspended', 'archived'));

-- personal は owner_user_id と community_id を必須とする。
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_personal_requires_owner;
ALTER TABLE public.spaces
  ADD CONSTRAINT spaces_personal_requires_owner
  CHECK (space_type <> 'personal' OR (owner_user_id IS NOT NULL AND community_id IS NOT NULL));

-- 1 人につき 1 コミュニティ内で個人スペースは 1 つ（部分 UNIQUE）。
CREATE UNIQUE INDEX IF NOT EXISTS spaces_personal_unique
  ON public.spaces (community_id, owner_user_id)
  WHERE space_type = 'personal';

-- ---------------------------------------------------------------------------
-- 2. can_access_space を personal 対応へ更新（Phase 2.5 の seam を拡張）
--    shared: 従来どおり全員可視（public space のゲスト体験を維持）。
--    personal: owner 本人 / 所属コミュニティ管理者 / super_admin のみ。
--    anon は auth.uid()=NULL のため personal に一致しない＝不可。
-- ---------------------------------------------------------------------------
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
        s.space_type <> 'personal'
        -- owner 本人は space が active のときのみ（§10.6: suspend/archived でアクセス不可）
        OR (s.owner_user_id = auth.uid() AND s.status = 'active')
        -- 所属コミュニティ管理者は status に関わらず可（停止/再開の管理・データ保持のため）
        OR EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = s.community_id AND c.admin_id = auth.uid()
        )
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_space(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_space(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. SELECT ポリシーを helper に束ねる
--    spaces: personal を owner/所属管理者/super_admin のみに限定（shared は不変）。
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "public read spaces" ON public.spaces;
DROP POLICY IF EXISTS "spaces_select_all" ON public.spaces;
DROP POLICY IF EXISTS "spaces_select_accessible" ON public.spaces;
CREATE POLICY "spaces_select_accessible" ON public.spaces
  FOR SELECT
  USING (public.can_access_space(id));

-- hossiis: 所属スペースのアクセス条件を継承する。
--   未削除 かつ can_access_space かつ (public または本人の owner_only)。
--   shared スペースでは can_access_space=true のため従来と同一挙動。
--   personal スペースでは owner/所属管理者/super_admin のみが public 投稿を閲覧でき、
--   owner_only は投稿本人だけ（管理者にも見えない）。
DROP POLICY IF EXISTS "read visible hossiis" ON public.hossiis;
CREATE POLICY "read visible hossiis" ON public.hossiis
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.can_access_space(space_id)
    AND (
      visibility = 'public'
      OR (
        visibility = 'owner_only'
        AND public.hossii_is_owned_by_current_user(id)
      )
    )
  );

-- space_panes: personal スペースの pane を非アクセス者へ見せない。
--   shared では is_visible AND true = is_visible（従来どおり）。所属管理者は非表示 pane も可。
DROP POLICY IF EXISTS "space_panes_select_visible_or_admin" ON public.space_panes;
CREATE POLICY "space_panes_select_visible_or_admin" ON public.space_panes
  FOR SELECT
  USING (
    (is_visible = true AND public.can_access_space(space_id))
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. ensure_my_personal_space: active community member による冪等な個人スペース作成
--    - authenticated のみ（anon には EXECUTE 無し）。
--    - auth.uid() が正本。owner_user_id を引数に取らない（なりすまし不可）。
--    - active member のみ（invited/suspended/removed/非member/guest は不可）。
--    - 冪等: 既存があれば返す。別 community は別スペース。
--    - slug/id は (community, owner) の安定ハッシュから生成（改名で変わらない・community 内一意）。
--    - PII を返さない（space id / url のみ）。
--    - デフォルト pane は spaces INSERT の既存トリガ insert_default_space_pane が自動作成。
--    - shared スペースへ自動同期しない（この関数は shared に一切書き込まない）。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_my_personal_space(p_community_id uuid)
RETURNS TABLE (space_id text, space_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_space_id  text;
  v_space_url text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = p_community_id
      AND cm.auth_user_id = v_uid
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'not an active member of this community';
  END IF;

  -- 既存を返す（冪等）
  SELECT s.id, s.space_url INTO v_space_id, v_space_url
  FROM public.spaces s
  WHERE s.space_type = 'personal'
    AND s.community_id = p_community_id
    AND s.owner_user_id = v_uid;
  IF FOUND THEN
    space_id := v_space_id; space_url := v_space_url;
    RETURN NEXT; RETURN;
  END IF;

  -- 安定 ID/slug（表示名・メール・username を正本にしない）
  v_space_id  := 'ps-' || substr(md5(p_community_id::text || ':' || v_uid::text), 1, 24);
  v_space_url := 'p-'  || substr(md5(p_community_id::text || ':' || v_uid::text), 1, 16);

  INSERT INTO public.spaces (id, name, space_url, community_id, space_type, owner_user_id, status)
  VALUES (v_space_id, '個人スペース', v_space_url, p_community_id, 'personal', v_uid, 'active')
  ON CONFLICT (id) DO NOTHING;

  -- 競合時も部分 UNIQUE により最終的に 1 行。再取得して返す。
  SELECT s.id, s.space_url INTO v_space_id, v_space_url
  FROM public.spaces s
  WHERE s.space_type = 'personal'
    AND s.community_id = p_community_id
    AND s.owner_user_id = v_uid;

  space_id := v_space_id; space_url := v_space_url;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_personal_space(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_my_personal_space(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_personal_space(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. list_my_community_personal_spaces: 本人の active community と個人スペース有無
--    UI（作る/開く/作成済み）を最小情報で駆動する。PII / admin_id を返さない。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_community_personal_spaces()
RETURNS TABLE (
  community_id           uuid,
  community_name         text,
  membership_status      text,
  personal_space_id      text,
  personal_space_url     text,
  personal_space_status  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    cm.community_id,
    c.name AS community_name,
    cm.status AS membership_status,
    s.id AS personal_space_id,
    s.space_url AS personal_space_url,
    s.status AS personal_space_status
  FROM public.community_memberships cm
  JOIN public.communities c ON c.id = cm.community_id
  LEFT JOIN public.spaces s
    ON s.space_type = 'personal'
   AND s.community_id = cm.community_id
   AND s.owner_user_id = cm.auth_user_id
  WHERE cm.auth_user_id = auth.uid()
    AND cm.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.list_my_community_personal_spaces() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_community_personal_spaces() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_community_personal_spaces() TO authenticated;
