-- ============================================================
-- space_panes: スーパー管理者向け RLS（全コミュニティ横断）
-- app_metadata.role = 'super_admin' の JWT で SELECT / INSERT / UPDATE を許可
-- ============================================================

CREATE POLICY "super_admin read all space_panes"
  ON public.space_panes
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "super_admin insert space_panes"
  ON public.space_panes
  FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "super_admin update space_panes"
  ON public.space_panes
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
