-- ============================================================
-- 匿名ユーザー対応 いいね RPC
-- ログイン不要・何回でも押せる increment 専用関数
-- ============================================================

-- SECURITY DEFINER により anon ロールでも実行可能
create or replace function increment_hossii_like(p_hossii_id text)
returns int
language sql
security definer
as $$
  update hossiis
  set like_count = like_count + 1
  where id = p_hossii_id
  returning like_count;
$$;
