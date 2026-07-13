-- ============================================================================
-- Phase 2D-1 reconciliation: hossiis の権限迂回を塞ぐ（3系統）
-- ----------------------------------------------------------------------------
-- 20260713130000 適用後に残っていた迂回経路を、新規 migration として収束させる。
-- 既存 migration は rename/削除/変更しない。development のみ適用。production 未操作。
-- 破壊的な投稿削除は行わない（policy / trigger / function / grant のみ）。
--
-- 対象:
--   1) 物理 DELETE: anon/一般 authenticated が REST から任意投稿を物理削除でき、
--      soft delete を迂回できる。→ コミュニティ管理者・super_admin・service_role/postgres
--      だけに限定する。本人削除は soft_delete_my_hossii のみ。
--   2) 管理者用 UPDATE 列 (is_hidden / hidden_at / hidden_by / space_pane_id):
--      column grant + UPDATE policy USING(true) の組み合わせで一般 authenticated が
--      他人の投稿のこれら4列を直接変更できてしまう。BEFORE UPDATE trigger で
--      コミュニティ管理者・super_admin のみに限定し、hidden_by は auth.uid() を強制。
--   3) increment_hossii_like: visibility/deleted を無視して like_count を更新・返却し、
--      owner_only/deleted 投稿の存在漏洩・不正 increment が可能。閲覧可能な投稿だけに限定。
--
-- 管理判定の正本（既存 space_panes / secure_my_hossii と同一パターン）:
--   super_admin       : (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
--   コミュニティ管理者 : spaces JOIN communities で c.admin_id = auth.uid()
--
-- 装飾・位置列 (bubble_color / position_x / position_y / is_position_fixed / scale) は
-- 既存の共同操作仕様（本人・ゲスト含む直接更新）を維持し、今回変更しない。
-- 管理者用4列とは trigger 上で明確に分離している。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 物理 DELETE の限定
--    - anon から DELETE grant を剥奪（REST から一切削除不可）。
--    - authenticated の DELETE grant は残し、DELETE RLS で
--      「その投稿の space が属する community の管理者」または super_admin のみに限定。
--    - service_role / postgres は BYPASSRLS のため管理削除・seed を維持。
--    既存の管理者 clear-all (deleteAllHossiisInSpace) は community 管理者なら全行が
--    自 community 配下のため引き続き成功する。
-- ---------------------------------------------------------------------------
REVOKE DELETE ON public.hossiis FROM anon;

DROP POLICY IF EXISTS "public delete hossiis" ON public.hossiis;

CREATE POLICY "hossiis_delete_community_admin" ON public.hossiis
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = hossiis.space_id
        AND c.admin_id = auth.uid()
    )
  );

CREATE POLICY "hossiis_delete_super_admin" ON public.hossiis
  FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- ---------------------------------------------------------------------------
-- 2) 管理者用 UPDATE 列の BEFORE UPDATE 検証 trigger
--    is_hidden / hidden_at / hidden_by / space_pane_id を変更できるのは
--    コミュニティ管理者・super_admin のみ。hidden_by は auth.uid() を強制（偽装防止）。
--
--    - SECURITY DEFINER のため current_user は判定に使えない（常に owner=postgres）。
--      代わりに auth.uid() の有無で「実ユーザー(JWTあり)による変更か」を判定する。
--      service_role / postgres / seed は auth.uid()=NULL のため bypass。
--      anon はこれら4列に UPDATE grant を持たないため到達しない。
--    - これら4列を変更しない通常更新（本文RPC・装飾・位置・visibility/soft delete RPC）は
--      外側 IF が偽となり素通りする。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_hossii_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
       NEW.is_hidden     IS DISTINCT FROM OLD.is_hidden
    OR NEW.hidden_at     IS DISTINCT FROM OLD.hidden_at
    OR NEW.hidden_by     IS DISTINCT FROM OLD.hidden_by
    OR NEW.space_pane_id IS DISTINCT FROM OLD.space_pane_id
  ) AND auth.uid() IS NOT NULL THEN
    IF NOT (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      OR EXISTS (
        SELECT 1
        FROM public.spaces s
        JOIN public.communities c ON c.id = s.community_id
        WHERE s.id = NEW.space_id
          AND c.admin_id = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'hossiis moderation columns (is_hidden/hidden_at/hidden_by/space_pane_id) require community admin or super_admin';
    END IF;

    -- hidden_by 偽装防止: 実際に操作した管理者の uid を強制。復帰時(is_hidden=false)は NULL。
    IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
       OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by THEN
      NEW.hidden_by := CASE WHEN NEW.is_hidden THEN auth.uid()::text ELSE NULL END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_hossii_admin_columns ON public.hossiis;
CREATE TRIGGER guard_hossii_admin_columns
  BEFORE UPDATE ON public.hossiis
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_hossii_admin_columns();

-- ---------------------------------------------------------------------------
-- 3) increment_hossii_like の privacy 修正
--    閲覧可能な投稿（未削除 かつ public または本人の owner_only）だけを increment し、
--    その like_count を返す。それ以外・存在しない投稿はいずれも 0 行更新 → NULL 返却で
--    区別できないようにする（存在漏洩なし・不正 increment なし・PII なし）。
--    search_path='' + schema 修飾 + EXECUTE は anon/authenticated（public いいね維持）。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_hossii_like(p_hossii_id text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.hossiis
  SET like_count = like_count + 1
  WHERE id = p_hossii_id
    AND deleted_at IS NULL
    AND (
      visibility = 'public'
      OR EXISTS (
        SELECT 1 FROM public.hossii_authorships a
        WHERE a.hossii_id = hossiis.id
          AND a.auth_user_id = auth.uid()
      )
    )
  RETURNING like_count;
$$;

REVOKE ALL ON FUNCTION public.increment_hossii_like(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_hossii_like(text) TO anon, authenticated;
