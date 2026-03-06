-- ============================================================
-- スーパー管理者向け RLS ポリシー追加
-- communities テーブルへの全件 SELECT を許可
-- ============================================================

-- 既存の "public read communities" ポリシーは全ユーザーに SELECT を許可しているため、
-- まず廃止してより制限的なポリシーに置き換える。
drop policy if exists "public read communities" on communities;

-- コミュニティ管理者: 自分のコミュニティのみ参照可
create policy "owner read communities"
  on communities
  for select
  using (admin_id = auth.uid());

-- スーパー管理者: 全コミュニティを参照可
-- app_metadata.role = 'super_admin' のユーザーに全件 SELECT を許可
create policy "super_admin read all communities"
  on communities
  for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- スーパー管理者: 全コミュニティの status を更新可（審査承認・却下のため）
create policy "super_admin update communities"
  on communities
  for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
