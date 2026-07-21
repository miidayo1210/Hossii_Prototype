-- read-only: Phase 1A admin answer export RPC (post-migration dev verification)
-- Usage: run against Development after `npm run db:push:dev`
-- Do NOT run against Production.

-- 1) Salt table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'space_export_identity_salts';

-- 2) RPC registered
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'admin_export_space_hossiis_page';

-- 3) Example call (replace space id; requires community admin JWT)
-- SELECT public.admin_export_space_hossiis_page(
--   p_space_id := 'YOUR_SHARED_SPACE_ID',
--   p_limit := 5
-- );
