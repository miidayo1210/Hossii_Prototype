-- ============================================================
-- Realtime: hossiis テーブルの設定
-- REPLICA IDENTITY FULL: DELETE イベントで old レコードを取得可能にする
-- supabase_realtime publication: Realtime イベントを有効化
-- ============================================================

-- DELETE イベントで old.space_id などが取得できるよう FULL に設定
alter table hossiis replica identity full;

-- Supabase の Realtime publication に hossiis を追加（未追加の場合のみ）
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'hossiis'
  ) then
    alter publication supabase_realtime add table hossiis;
  end if;
end $$;
