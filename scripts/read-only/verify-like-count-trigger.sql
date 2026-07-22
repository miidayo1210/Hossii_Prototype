-- READ-ONLY introspection for update_like_count() trigger fix (Development).
-- Run against linked dev project; no writes.

-- Function definition: SECURITY DEFINER + empty search_path
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_like_count';

-- Trigger unchanged
SELECT
  tg.tgname,
  c.relname AS table_name,
  pg_get_triggerdef(tg.oid) AS trigger_def
FROM pg_trigger tg
JOIN pg_class c ON c.oid = tg.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'hossii_likes'
  AND NOT tg.tgisinternal
ORDER BY tg.tgname;

-- authenticated must NOT have direct UPDATE on hossiis
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'hossiis'
  AND grantee = 'authenticated'
  AND privilege_type = 'UPDATE';

-- hossii_likes RLS policies unchanged (expect select_all, insert_own, delete_own)
SELECT polname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'hossii_likes'
ORDER BY polname;
