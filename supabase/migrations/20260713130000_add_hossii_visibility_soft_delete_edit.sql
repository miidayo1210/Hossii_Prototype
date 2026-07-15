-- ============================================================================
-- Phase 2D-1: ログイン本人による投稿の 編集 / ゴースト(owner_only) / ソフト削除 の DB 基盤
-- ----------------------------------------------------------------------------
-- 本 migration は UI を伴わない DB・権限・RPC 基盤のみ。投稿カードのメニューや
-- 操作 UI は Phase 2D-2 で追加する。
--
-- 追加する列:
--   visibility        text NOT NULL DEFAULT 'public'  CHECK (public|owner_only)
--   deleted_at        timestamptz NULL   （ソフト削除。物理 DELETE はしない）
--   content_edited_at timestamptz NULL   （本文編集成功時のみ更新）
--
-- 既存全投稿は visibility='public' / deleted_at=NULL となり従来どおり表示される。
-- 既存の管理者非表示列（is_hidden / hidden_at / hidden_by）は変更・置換・意味変更しない。
--
-- セキュリティ設計（REST / Supabase client からの直接操作でも他人の投稿・保護列を
-- 変更できないこと）:
--   1) 閲覧: SELECT RLS を厳格化し、deleted は全クライアントに、他人の owner_only は
--      本人以外に返さない。owner 判定は SECURITY DEFINER ヘルパで行う
--      （anon は hossii_authorships への grant が無いため RLS 内 subquery を避ける）。
--   2) 直接 UPDATE の封じ込め: column-level UPDATE grant により、client(anon/authenticated)
--      が直接 UPDATE できる列を既存アプリが使う装飾/レイアウト/モデレーション列だけに限定する。
--      本文・identity・visibility・deleted_at・content_edited_at は client から直接更新不可。
--   3) 本人操作: visibility / deleted_at / 本文編集 は SECURITY DEFINER RPC 経由のみ。
--      RPC は auth.uid() と hossii_authorships を正本に本人確認する（引数で uid/role を受け取らない）。
--      RPC は postgres 所有で実行され column grant / RLS を正当にバイパスする。
--
-- 物理 DELETE の grant / policy、装飾列の open な直接更新、is_hidden の client 直接更新は
-- 本 phase では変更しない（既存機能維持のため。Phase 2D-1 の保護対象は
-- 本文/identity/visibility/削除であり、これらは上記で担保される）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 列追加（冪等）
-- ---------------------------------------------------------------------------
ALTER TABLE public.hossiis ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
ALTER TABLE public.hossiis ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.hossiis ADD COLUMN IF NOT EXISTS content_edited_at timestamptz;

ALTER TABLE public.hossiis DROP CONSTRAINT IF EXISTS hossiis_visibility_check;
ALTER TABLE public.hossiis
  ADD CONSTRAINT hossiis_visibility_check CHECK (visibility IN ('public', 'owner_only'));

-- 取得時の主な絞り込み（space 内の未削除投稿）用の軽量 index。過剰な index は作らない。
CREATE INDEX IF NOT EXISTS idx_hossiis_space_not_deleted
  ON public.hossiis (space_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2) owner 判定ヘルパ（SECURITY DEFINER）と SELECT RLS の厳格化
--    - anon は hossii_authorships への grant を持たないため、RLS policy 内で直接
--      subquery すると permission error になる。SECURITY DEFINER 関数で吸収する。
--    - auth.uid() が NULL（anon）なら常に false を返す。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hossii_is_owned_by_current_user(p_hossii_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hossii_authorships a
    WHERE a.hossii_id = p_hossii_id
      AND a.auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.hossii_is_owned_by_current_user(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hossii_is_owned_by_current_user(text) TO anon, authenticated;

-- SELECT RLS を差し替える。
-- 通常クライアント（anon / authenticated）が取得できるのは:
--   deleted_at IS NULL AND (public OR 自分の owner_only)
-- service_role / postgres は BYPASSRLS のため従来どおり全件確認可能。
DROP POLICY IF EXISTS "public read hossiis" ON public.hossiis;
CREATE POLICY "read visible hossiis" ON public.hossiis
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      visibility = 'public'
      OR (
        visibility = 'owner_only'
        AND public.hossii_is_owned_by_current_user(id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) column-level UPDATE grant による直接 UPDATE の封じ込め
--    既存アプリが直接 UPDATE している列だけを client へ許可する:
--      - 装飾/レイアウト（本人・ゲスト・管理者が使用）: bubble_color, position_*, scale
--      - モデレーション/移動（管理者=authenticated が使用）: is_hidden, hidden_at, hidden_by, space_pane_id
--    それ以外（本文・identity・visibility・deleted_at・content_edited_at・like_count 等）は
--    client から直接 UPDATE 不可。RPC(postgres) は full grant のため引き続き更新可能。
-- ---------------------------------------------------------------------------
REVOKE UPDATE ON public.hossiis FROM anon;
REVOKE UPDATE ON public.hossiis FROM authenticated;

GRANT UPDATE (bubble_color, position_x, position_y, is_position_fixed, scale)
  ON public.hossiis TO anon, authenticated;

-- モデレーション/Pane 移動は管理者（authenticated）のみ直接更新可能にする（anon には付与しない）。
GRANT UPDATE (is_hidden, hidden_at, hidden_by, space_pane_id)
  ON public.hossiis TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) 本人操作 RPC（すべて SECURITY DEFINER / search_path='' / auth.uid() 正本）
-- ---------------------------------------------------------------------------

-- 4-1) 本文編集。本人・未削除のときのみ message を更新し content_edited_at=now()。
--      author_name / identity / visibility / deleted_at には一切触れない。
CREATE OR REPLACE FUNCTION public.update_my_hossii(
  p_hossii_id text,
  p_message   text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_edited timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_message IS NULL THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  UPDATE public.hossiis h
  SET message = p_message,
      content_edited_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    )
  RETURNING h.content_edited_at INTO v_edited;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;

  RETURN v_edited;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_hossii(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_hossii(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_my_hossii(text, text) TO authenticated;

-- 4-2) 公開範囲の変更（public <-> owner_only）。本人・未削除のときのみ。
CREATE OR REPLACE FUNCTION public.set_my_hossii_visibility(
  p_hossii_id  text,
  p_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_visibility NOT IN ('public', 'owner_only') THEN
    RAISE EXCEPTION 'invalid visibility';
  END IF;

  UPDATE public.hossiis h
  SET visibility = p_visibility
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, deleted, or not owned by current user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_hossii_visibility(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_hossii_visibility(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_hossii_visibility(text, text) TO authenticated;

-- 4-3) ソフト削除。本人・未削除のときのみ deleted_at=now()。物理 DELETE はしない。
--      authorship / コメント / like 等の関連行は破壊しない。
CREATE OR REPLACE FUNCTION public.soft_delete_my_hossii(
  p_hossii_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  UPDATE public.hossiis h
  SET deleted_at = now()
  WHERE h.id = p_hossii_id
    AND h.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hossii_authorships a
      WHERE a.hossii_id = h.id AND a.auth_user_id = v_uid
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hossii not found, already deleted, or not owned by current user';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_my_hossii(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.soft_delete_my_hossii(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_my_hossii(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Phase 2C RPC の privacy 監査・更新
--    SECURITY DEFINER のため visibility / deleted_at を無視すると非公開投稿の存在を
--    漏らす。閲覧可能な投稿（未削除 かつ public または本人の owner_only）だけを返す。
--    返却列は従来どおり hossii_id / current_space_nickname の 2 列のみ。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_space_post_author_display_names(
  p_space_id text
)
RETURNS TABLE (
  hossii_id             text,
  current_space_nickname text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT h.id AS hossii_id,
         m.space_nickname AS current_space_nickname
  FROM public.hossiis h
  JOIN public.hossii_authorships a
    ON a.hossii_id = h.id
  JOIN public.space_memberships m
    ON m.space_id = h.space_id
   AND m.auth_user_id = a.auth_user_id
  WHERE h.space_id = p_space_id
    AND h.deleted_at IS NULL
    AND (
      h.visibility = 'public'
      OR a.auth_user_id = auth.uid()   -- 本人の owner_only のみ本人へ返す
    )
    AND m.space_nickname IS NOT NULL
    AND btrim(m.space_nickname) <> '';
$$;

REVOKE ALL ON FUNCTION public.fetch_space_post_author_display_names(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_space_post_author_display_names(text) TO anon, authenticated;
