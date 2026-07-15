#!/usr/bin/env node
/**
 * READ-ONLY verification of hossii_authorships on the DEVELOPMENT database.
 * Runs only SELECT / catalog introspection. No writes.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const EXPECTED_DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const password = readFileSync('.supabase-dev-db-password.local', 'utf8').trim();

// Derive host/user from the CLI-linked pooler-url so we hit the exact linked project.
const poolerUrl = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
const parsed = new URL(poolerUrl);
const user = decodeURIComponent(parsed.username); // postgres.<ref>
const host = parsed.hostname;
const port = Number(parsed.port || 5432);

// SAFETY: refuse to run unless the linked project is the expected development ref.
if (!user.endsWith(EXPECTED_DEV_REF)) {
  console.error(`ABORT: linked pooler user "${user}" is not development (${EXPECTED_DEV_REF}).`);
  process.exit(2);
}

const candidates = [{ host, port, user }];

async function connect() {
  for (const c of candidates) {
    const client = new pg.Client({
      host: c.host,
      port: c.port,
      user: c.user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      console.error(`connected via ${c.host} (${c.user})`);
      return client;
    } catch (e) {
      console.error(`  x ${c.host}: ${e.message}`);
      try { await client.end(); } catch { /* ignore */ }
    }
  }
  throw new Error('all connection candidates failed');
}

const q = async (client, label, sql) => {
  const { rows } = await client.query(sql);
  return [label, rows];
};

const client = await connect();
const out = {};
try {
  for (const [label, rows] of await Promise.all([
    q(client, 'columns', `
      SELECT column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='hossii_authorships'
      ORDER BY ordinal_position;`),
    q(client, 'constraints', `
      SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='hossii_authorships'
      ORDER BY con.contype, con.conname;`),
    q(client, 'indexes', `
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename='hossii_authorships'
      ORDER BY indexname;`),
    q(client, 'rls', `
      SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls, c.relkind
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='hossii_authorships';`),
    q(client, 'policies', `
      SELECT pol.polname,
        CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS cmd,
        pol.polpermissive,
        (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid=ANY(pol.polroles)) AS roles,
        pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
      FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='hossii_authorships'
      ORDER BY pol.polname;`),
    q(client, 'table_grants', `
      SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='hossii_authorships'
        AND grantee IN ('anon','authenticated','service_role','postgres')
      GROUP BY grantee ORDER BY grantee;`),
    q(client, 'function_def', `
      SELECT p.proname, pg_get_functiondef(p.oid) AS def, p.prosecdef AS security_definer,
        p.proconfig AS config, pg_get_userbyid(p.proowner) AS owner
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='link_hossii_authorship_after_insert';`),
    q(client, 'function_privs', `
      SELECT grantee, privilege_type
      FROM information_schema.role_routine_grants
      WHERE routine_schema='public' AND routine_name='link_hossii_authorship_after_insert'
      ORDER BY grantee, privilege_type;`),
    q(client, 'trigger_def', `
      SELECT t.tgname, pg_get_triggerdef(t.oid) AS def, t.tgenabled
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='hossiis'
        AND t.tgname='hossiis_after_insert_link_authorship';`),
    q(client, 'row_count', `SELECT count(*)::int AS n FROM public.hossii_authorships;`),
    q(client, 'migration_recorded', `
      SELECT version, name FROM supabase_migrations.schema_migrations
      WHERE version IN ('20260627100000','20260629120000','20260712090000')
      ORDER BY version;`),
  ])) {
    out[label] = rows;
  }
  console.log(JSON.stringify(out, null, 2));
} finally {
  await client.end();
}
