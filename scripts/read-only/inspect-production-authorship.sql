-- READ ONLY INSPECTION
-- TARGET: production wzyoddyvfjkagqpnjejo
-- DO NOT RUN AGAINST ANOTHER PROJECT WITHOUT CONFIRMING THE TARGET
-- ============================================================================
-- inspect-production-authorship.sql  (READ-ONLY / Phase 1A)
-- ----------------------------------------------------------------------------
-- 目的: production (wzyoddyvfjkagqpnjejo) の hossii_authorships 実体を read-only
--       で確認する。Supabase Dashboard の SQL Editor にそのまま貼り付けて実行。
--
-- 使い方:
--   1. このファイル全文を Supabase SQL Editor に貼り付ける
--   2. そのまま Run（1つの結果グリッドに全セクションが (ord, section, data) で返る）
--   3. 結果グリッドを全選択コピーして Cursor に貼り付ける
--
-- 制約（厳守）:
--   * SELECT / WITH / information_schema / pg_catalog のみ
--   * INSERT / UPDATE / DELETE / CREATE / ALTER / DROP / TRUNCATE / GRANT /
--     REVOKE / migration適用 / 書き込みfunction は一切含まない
--   * 個人情報（UUID実値・メール・表示名）は出力しない。件数・定義・集計のみ
--     - created_at の最古/最新（タイムスタンプ）のみ例外的に出力
--   * data は jsonb。定義文（pg_get_functiondef 等）は文字列として格納
--
-- 注意:
--   * Supabase SQL Editor は複数文実行時に最後の文の結果のみ返すため、
--     本ファイルは「単一の SELECT」に集約している
--   * section 11 は schema_migrations の列構造も併せて返す（環境差異の確認用）。
--     存在確認は列名を直接参照せず to_jsonb(sm) ->> 'version' で行う。
--     これにより version 列が無い環境でも SQL 全体が解析時に失敗しない
--   * section 08 は authorship 関連 trigger（tgname / proname に 'authorship' を
--     含むもの）だけに限定。無関係な trigger/function 全文は出力しない
-- ============================================================================

WITH
-- 1. 対象DB確認 -------------------------------------------------------------
sec1_target AS (
  SELECT jsonb_build_object(
    'database_name', current_database(),
    'current_user',  current_user,
    'current_schema', current_schema()
  ) AS d
),
-- 2. テーブル列定義 ---------------------------------------------------------
sec2_columns AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'column_name', column_name,
      'data_type',   data_type,
      'udt_name',    udt_name,
      'is_nullable', is_nullable,
      'column_default', column_default,
      'ordinal_position', ordinal_position
    ) ORDER BY ordinal_position
  ) AS d
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'hossii_authorships'
),
-- 3. 制約（PK / FK / UNIQUE / CHECK）---------------------------------------
sec3_constraints AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', conname,
      'type', contype::text,          -- p=pk, f=fk, u=unique, c=check
      'definition', pg_get_constraintdef(oid)
    )
  ) AS d
  FROM pg_constraint
  WHERE conrelid = 'public.hossii_authorships'::regclass
),
-- 4. index -----------------------------------------------------------------
sec4_index AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'index_name', indexname,
      'definition', indexdef,
      'is_unique',  (indexdef ILIKE '%UNIQUE%'),
      'is_primary', (indexname = (
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.hossii_authorships'::regclass AND contype = 'p'
        LIMIT 1
      ))
    )
  ) AS d
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'hossii_authorships'
),
-- 5. table属性（owner / RLS / force RLS / persistence）---------------------
sec5_table AS (
  SELECT jsonb_build_object(
    'owner',        pg_get_userbyid(relowner),
    'rls_enabled',  relrowsecurity,
    'force_rls',    relforcerowsecurity,
    'persistence',  relpersistence::text   -- p=permanent, u=unlogged, t=temp
  ) AS d
  FROM pg_class
  WHERE oid = 'public.hossii_authorships'::regclass
),
-- 6. policy ----------------------------------------------------------------
sec6_policy AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'policy_name', policyname,
      'command',     cmd,
      'roles',       roles::text[],
      'permissive',  permissive,
      'using',       qual,
      'with_check',  with_check
    )
  ) AS d
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'hossii_authorships'
),
-- 7. grant（対象role限定）--------------------------------------------------
sec7_grant AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'grantee',        grantee,
      'privilege_type', privilege_type,
      'is_grantable',   is_grantable
    )
  ) AS d
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'hossii_authorships'
    AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
),
-- 8. trigger（public.hossiis 上の authorship 関連 trigger のみ）------------
--    tgname または function 名に 'authorship' を含むものだけに限定。
--    0件なら d は NULL（＝ authorship trigger 不在として判別可能）。
sec8_trigger AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'trigger_name',     t.tgname,
      'enabled',          t.tgenabled::text,  -- O=enabled, D=disabled, R/A=replica等
      'trigger_def',      pg_get_triggerdef(t.oid),
      'function_schema',  n.nspname,
      'function_name',    p.proname,
      'function_owner',   pg_get_userbyid(p.proowner),
      'security_definer', p.prosecdef,
      'config',           p.proconfig,        -- search_path 等
      'function_def',     pg_get_functiondef(p.oid)
    )
  ) AS d
  FROM pg_trigger t
  JOIN pg_proc p      ON p.oid = t.tgfoid
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE t.tgrelid = 'public.hossiis'::regclass
    AND NOT t.tgisinternal
    AND (t.tgname ILIKE '%authorship%' OR p.proname ILIKE '%authorship%')
),
-- 9. データ健全性（集計のみ・UUID実値は出さない）-------------------------
sec9_health AS (
  SELECT jsonb_build_object(
    'total_rows',            (SELECT count(*) FROM public.hossii_authorships),
    'distinct_hossii_id',    (SELECT count(DISTINCT hossii_id) FROM public.hossii_authorships),
    'distinct_auth_user_id', (SELECT count(DISTINCT auth_user_id) FROM public.hossii_authorships),
    'hossii_id_null',        (SELECT count(*) FROM public.hossii_authorships WHERE hossii_id IS NULL),
    'auth_user_id_null',     (SELECT count(*) FROM public.hossii_authorships WHERE auth_user_id IS NULL),
    'oldest_created_at',     (SELECT min(created_at) FROM public.hossii_authorships),
    'newest_created_at',     (SELECT max(created_at) FROM public.hossii_authorships),
    'duplicate_hossii_id_groups',
        (SELECT count(*) FROM (
           SELECT hossii_id FROM public.hossii_authorships
           GROUP BY hossii_id HAVING count(*) > 1
         ) dup),
    'orphan_hossii_id',
        (SELECT count(*) FROM public.hossii_authorships a
           LEFT JOIN public.hossiis h ON h.id = a.hossii_id
          WHERE h.id IS NULL),
    'multi_auth_user_per_hossii',
        (SELECT count(*) FROM (
           SELECT hossii_id FROM public.hossii_authorships
           GROUP BY hossii_id HAVING count(DISTINCT auth_user_id) > 1
         ) multi)
  ) AS d
),
-- 10. 関連投稿集計（UUID実値は出さない）----------------------------------
sec10_posts AS (
  SELECT jsonb_build_object(
    'hossii_with_authorship',
        (SELECT count(DISTINCT a.hossii_id)
           FROM public.hossii_authorships a
           JOIN public.hossiis h ON h.id = a.hossii_id),
    'hossii_without_authorship',
        (SELECT count(*)
           FROM public.hossiis h
           LEFT JOIN public.hossii_authorships a ON a.hossii_id = h.id
          WHERE a.hossii_id IS NULL),
    'author_id_equals_auth_user_id',
        (SELECT count(*)
           FROM public.hossii_authorships a
           JOIN public.hossiis h ON h.id = a.hossii_id
          WHERE h.author_id = a.auth_user_id::text),
    'author_id_differs_from_auth_user_id',
        (SELECT count(*)
           FROM public.hossii_authorships a
           JOIN public.hossiis h ON h.id = a.hossii_id
          WHERE h.author_id IS DISTINCT FROM a.auth_user_id::text)
  ) AS d
),
-- 11a. schema_migrations の列構造（環境差異確認）--------------------------
sec11_migration_columns AS (
  SELECT jsonb_agg(
    jsonb_build_object('column_name', column_name, 'data_type', data_type)
    ORDER BY ordinal_position
  ) AS d
  FROM information_schema.columns
  WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
),
-- 11b. 特定 version の存在のみ（列名を直接参照せず to_jsonb で確認）--------
--    version 列が無い環境でも SQL 全体が解析時に失敗しない。列が無ければ
--    to_jsonb(sm)->>'version' は NULL となり、両方 false になる。
sec11_migration_exist AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'version', target.version,
      'exists_in_history',
        EXISTS (
          SELECT 1
          FROM supabase_migrations.schema_migrations AS sm
          WHERE to_jsonb(sm) ->> 'version' = target.version
        )
    ) ORDER BY target.version
  ) AS d
  FROM (VALUES ('20260627100000'), ('20260629120000')) AS target(version)
)
-- 集約: 単一の結果グリッド (ord, section, data) -----------------------------
SELECT ord, section, data FROM (
  SELECT  1 AS ord, '01_target_db'            AS section, (SELECT d FROM sec1_target)             AS data
  UNION ALL SELECT  2, '02_columns',              (SELECT d FROM sec2_columns)
  UNION ALL SELECT  3, '03_constraints',          (SELECT d FROM sec3_constraints)
  UNION ALL SELECT  4, '04_indexes',              (SELECT d FROM sec4_index)
  UNION ALL SELECT  5, '05_table_attributes',     (SELECT d FROM sec5_table)
  UNION ALL SELECT  6, '06_policies',             (SELECT d FROM sec6_policy)
  UNION ALL SELECT  7, '07_grants',               (SELECT d FROM sec7_grant)
  UNION ALL SELECT  8, '08_triggers_on_hossiis',  (SELECT d FROM sec8_trigger)
  UNION ALL SELECT  9, '09_data_health',          (SELECT d FROM sec9_health)
  UNION ALL SELECT 10, '10_post_correlation',     (SELECT d FROM sec10_posts)
  UNION ALL SELECT 11, '11a_migration_columns',   (SELECT d FROM sec11_migration_columns)
  UNION ALL SELECT 12, '11b_migration_exists',    (SELECT d FROM sec11_migration_exist)
) sections
ORDER BY ord;
