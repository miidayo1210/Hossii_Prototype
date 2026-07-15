-- ============================================================================
-- rls_foundation_space_access  (Phase 2.5: RLS 基盤整理)
-- ----------------------------------------------------------------------------
-- 目的（109 §17.2 / §17.3）:
--   初期 schema に残存する「匿名クライアントが spaces を書き換えられる」Critical な
--   ポリシーを塞ぎ、個人スペース（Phase 3）・invite_only（Phase 5）の SELECT を
--   束ねる共通 scope helper を用意する。
--
-- 本 migration の範囲（Phase 2.5）:
--   Step 1（棚卸し）: 下記コメントに現状ポリシーを明記。
--   Step 2（helper）: can_access_space(space_id) を新設（この時点では全ての既存
--                     spaces は shared/public 相当のため true を返す。Phase 3 が
--                     personal 判定を CREATE OR REPLACE で追加する）。
--   Step 4（anon 書き込み禁止）: spaces の public insert/update/delete を撤去し、
--                     anon の書き込み grant を剥奪。super_admin 用の管理ポリシーを追加。
--
-- 現状ポリシー棚卸し（適用前）:
--   spaces:
--     - "public read spaces"   SELECT USING(true)              … 維持（ゲスト入室）
--     - "spaces_select_all"    SELECT USING(true)              … 維持（Phase 3 で置換）
--     - "public insert spaces" INSERT WITH CHECK(true)         … 撤去（Critical: anon 書込）
--     - "public update spaces" UPDATE USING(true)              … 撤去（Critical: anon 書込）
--     - "public delete spaces" DELETE USING(true)              … 撤去（Critical: anon 書込）
--     - "spaces_insert_own/update_own/delete_own"              … 維持（コミュニティ管理者）
--   hossiis:
--     - SELECT "read visible hossiis"（未削除 かつ public/本人 owner_only）… 維持
--     - DELETE はコミュニティ管理者・super_admin のみ（20260713140000）    … 維持
--     - 直接 UPDATE は列 grant で装飾/モデレーションに限定（20260713130000）… 維持
--     - INSERT "public insert hossiis" WITH CHECK(true)（ゲスト投稿）        … 維持
--   space_nicknames:
--     - public read/insert/update/delete（端末 profile ベースの旧ニックネーム系）
--       … 本 Phase では維持（ゲストのニックネーム保存が依存。auth ベースの正式な
--          ニックネームは space_memberships 側にあり、こちらは legacy。個人スペースは
--          space_nicknames を使わないため個人スペースの秘匿性には影響しない。
--          将来 Phase 5 で auth スコープ化を検討）。
--
-- 受け入れ（§21.3）:
--   - anon が spaces 設定を UPDATE できない。
--   - anon が他人投稿を UPDATE/DELETE できない（本文/identity/visibility/削除は既に不可。
--     装飾列の共同編集は public space の体験として意図的に維持）。
--   - public space のゲスト参加・投稿が従来どおり動作する。
--
-- 安全性: 冪等（DROP ... IF EXISTS / CREATE OR REPLACE）。destructive DML なし。
--         development のみ。production 未操作。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Step 2: scope 判定 helper（個人スペース/invite_only を一元判定する seam）
--   現時点では全 spaces が shared/public 相当のため「存在すれば可視」を返す。
--   Phase 3 で personal（owner/所属管理者/super_admin のみ）判定を追加する。
--   SECURITY DEFINER: 呼び出しロールに依らず spaces/communities 等を参照するため。
--   anon の場合 auth.uid() は NULL。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_space(p_space_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s WHERE s.id = p_space_id
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_space(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_space(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 4: spaces への匿名書き込みを撤去
--   初期 schema の public insert/update/delete を削除し、anon の書き込み grant を剥奪。
--   SELECT（public read spaces / spaces_select_all）と管理者ポリシーは維持する。
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "public insert spaces" ON public.spaces;
DROP POLICY IF EXISTS "public update spaces" ON public.spaces;
DROP POLICY IF EXISTS "public delete spaces" ON public.spaces;

-- anon には spaces の書き込み権限を残さない（SELECT のみ）。
REVOKE INSERT, UPDATE, DELETE ON public.spaces FROM anon;

-- super_admin の管理を維持する（従来は public 書込ポリシー経由で可能だったため、
-- 撤去に伴い明示ポリシーを付与する。コミュニティ管理者は既存の *_own ポリシーで可）。
DROP POLICY IF EXISTS "spaces_insert_super_admin" ON public.spaces;
CREATE POLICY "spaces_insert_super_admin" ON public.spaces
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS "spaces_update_super_admin" ON public.spaces;
CREATE POLICY "spaces_update_super_admin" ON public.spaces
  FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS "spaces_delete_super_admin" ON public.spaces;
CREATE POLICY "spaces_delete_super_admin" ON public.spaces
  FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
