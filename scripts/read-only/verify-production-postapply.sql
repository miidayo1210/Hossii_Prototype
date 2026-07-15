-- ============================================================================
-- verify-production-postapply.sql   (READ ONLY / Phase 1B-1 post-apply)
-- ----------------------------------------------------------------------------
-- TARGET: production  wzyoddyvfjkagqpnjejo
-- DO NOT RUN AGAINST ANOTHER PROJECT WITHOUT CONFIRMING THE TARGET
-- SELECT only. No INSERT/UPDATE/DELETE/DDL. No PII (counts / definitions only).
-- Paste into the Supabase Dashboard SQL Editor and Run once.
-- ============================================================================
WITH
columns_c AS (
  SELECT jsonb_agg(jsonb_build_object(
    'column_name', column_name, 'data_type', data_type, 'udt_name', udt_name,
    'is_nullable', is_nullable, 'column_default', column_default, 'pos', ordinal_position
  ) ORDER BY ordinal_position) AS d
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='hossii_authorships'
),
constraints_c AS (
  SELECT jsonb_agg(jsonb_build_object(
    'conname', con.conname, 'contype', con.contype, 'def', pg_get_constraintdef(con.oid)
  ) ORDER BY con.contype, con.conname) AS d
  FROM pg_constraint con
  JOIN pg_class c ON c.oid=con.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='hossii_authorships'
),
indexes_c AS (
  SELECT jsonb_agg(jsonb_build_object('indexname', indexname, 'indexdef', indexdef) ORDER BY indexname) AS d
  FROM pg_indexes WHERE schemaname='public' AND tablename='hossii_authorships'
),
rls_c AS (
  SELECT jsonb_build_object('rls_enabled', c.relrowsecurity, 'force_rls', c.relforcerowsecurity, 'relkind', c.relkind) AS d
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='hossii_authorships'
),
policies_c AS (
  SELECT jsonb_agg(jsonb_build_object(
    'polname', pol.polname,
    'cmd', CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END,
    'permissive', pol.polpermissive,
    'roles', (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid=ANY(pol.polroles)),
    'using', pg_get_expr(pol.polqual, pol.polrelid),
    'check', pg_get_expr(pol.polwithcheck, pol.polrelid)
  ) ORDER BY pol.polname) AS d
  FROM pg_policy pol
  JOIN pg_class c ON c.oid=pol.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='hossii_authorships'
),
table_grants_c AS (
  SELECT jsonb_object_agg(grantee, privs) AS d FROM (
    SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='hossii_authorships'
      AND grantee IN ('anon','authenticated','service_role','postgres')
    GROUP BY grantee
  ) g
),
function_c AS (
  SELECT jsonb_build_object(
    'proname', p.proname, 'security_definer', p.prosecdef, 'owner', pg_get_userbyid(p.proowner),
    'config', p.proconfig,
    'has_on_conflict', (position('ON CONFLICT' IN upper(pg_get_functiondef(p.oid))) > 0),
    'def', pg_get_functiondef(p.oid)
  ) AS d
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='link_hossii_authorship_after_insert'
),
function_grants_c AS (
  SELECT jsonb_agg(jsonb_build_object('grantee', grantee, 'priv', privilege_type)
                   ORDER BY grantee, privilege_type) AS d
  FROM information_schema.role_routine_grants
  WHERE routine_schema='public' AND routine_name='link_hossii_authorship_after_insert'
),
trigger_c AS (
  SELECT jsonb_agg(jsonb_build_object('tgname', t.tgname, 'enabled', t.tgenabled, 'def', pg_get_triggerdef(t.oid))) AS d
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='hossiis' AND t.tgname='hossiis_after_insert_link_authorship'
),
data_health_c AS (
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.hossii_authorships),
    'distinct_hossii_id', (SELECT count(DISTINCT hossii_id) FROM public.hossii_authorships),
    'distinct_auth_user', (SELECT count(DISTINCT auth_user_id) FROM public.hossii_authorships),
    'hossii_id_null', (SELECT count(*) FROM public.hossii_authorships WHERE hossii_id IS NULL),
    'auth_user_null', (SELECT count(*) FROM public.hossii_authorships WHERE auth_user_id IS NULL),
    'orphans', (SELECT count(*) FROM public.hossii_authorships a
                  LEFT JOIN public.hossiis h ON h.id=a.hossii_id WHERE h.id IS NULL),
    'dup_hossii_id', (SELECT count(*) FROM (
                        SELECT hossii_id FROM public.hossii_authorships
                        GROUP BY hossii_id HAVING count(*)>1) x),
    'multi_auth_per_hossii', (SELECT count(*) FROM (
                        SELECT hossii_id FROM public.hossii_authorships
                        GROUP BY hossii_id HAVING count(DISTINCT auth_user_id)>1) y),
    'oldest', (SELECT min(created_at) FROM public.hossii_authorships),
    'newest', (SELECT max(created_at) FROM public.hossii_authorships)
  ) AS d
),
migrations_c AS (
  SELECT jsonb_agg(jsonb_build_object(
    'version', target.version,
    'recorded', EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations sm
                          WHERE to_jsonb(sm)->>'version' = target.version),
    'name', (SELECT to_jsonb(sm)->>'name' FROM supabase_migrations.schema_migrations sm
                WHERE to_jsonb(sm)->>'version' = target.version)
  ) ORDER BY target.version) AS d
  FROM (VALUES ('20260627100000'),('20260629120000'),('20260712090000')) AS target(version)
)
SELECT ord, section, data FROM (
  SELECT  1 AS ord, '01_columns'         AS section, (SELECT d FROM columns_c)        AS data
  UNION ALL SELECT  2, '02_constraints',   (SELECT d FROM constraints_c)
  UNION ALL SELECT  3, '03_indexes',       (SELECT d FROM indexes_c)
  UNION ALL SELECT  4, '04_rls',           (SELECT d FROM rls_c)
  UNION ALL SELECT  5, '05_policies',      (SELECT d FROM policies_c)
  UNION ALL SELECT  6, '06_table_grants',  (SELECT d FROM table_grants_c)
  UNION ALL SELECT  7, '07_function',      (SELECT d FROM function_c)
  UNION ALL SELECT  8, '08_function_grants',(SELECT d FROM function_grants_c)
  UNION ALL SELECT  9, '09_trigger',       (SELECT d FROM trigger_c)
  UNION ALL SELECT 10, '10_data_health',   (SELECT d FROM data_health_c)
  UNION ALL SELECT 11, '11_migrations',    (SELECT d FROM migrations_c)
) s ORDER BY ord;
