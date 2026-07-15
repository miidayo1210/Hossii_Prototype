-- ============================================================================
-- reconcile_space_panes_delete_policies  (Phase 1B-2)
-- ----------------------------------------------------------------------------
-- 目的:
--   space_panes の DELETE ポリシー2本を、新しい未使用 version で
--   development / production の両方へ収束させる。
--
-- 背景（version collision）:
--   version 20260629120000 が環境ごとに別内容になっている。
--     - main / development : 20260629120000_space_panes_delete_rls.sql
--                            （この DELETE ポリシー2本を作成、適用済み）
--     - production          : 20260629120000 = add_hossii_authorships
--                            （authorship follow-up が同 version を消費）
--   その結果 production では上記 DELETE ポリシーが db push でスキップされ、
--   現在 space_panes の DELETE ポリシーが 0 件になっている。
--
-- 正本:
--   supabase/migrations/20260629120000_space_panes_delete_rls.sql
--   のポリシー定義をそのまま使用する。
--   （正本には TO 句が無く PUBLIC ロール対象。development の現状も PUBLIC。
--     ここでも TO 句を付けず正本と完全一致させる。）
--
-- 冪等性:
--   DROP POLICY IF EXISTS + CREATE POLICY のみ。
--   table / column / index / function / trigger / grant には触れない。
-- ============================================================================

DROP POLICY IF EXISTS "space_panes_delete_admin" ON public.space_panes;
CREATE POLICY "space_panes_delete_admin"
  ON public.space_panes
  FOR DELETE
  USING (
    NOT is_default
    AND EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "super_admin delete space_panes" ON public.space_panes;
CREATE POLICY "super_admin delete space_panes"
  ON public.space_panes
  FOR DELETE
  USING (
    NOT is_default
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
