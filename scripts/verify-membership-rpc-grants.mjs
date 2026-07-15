#!/usr/bin/env node
/**
 * Development verification for ensure_community_membership_for_space_member RPC grants.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_URL = 'https://uodaubhlcvvqlgsdxcdf.supabase.co';
const SPACE_ID = 'dev-space-public';

function loadEnv(key) {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() ?? '';
}

const anon = loadEnv('VITE_SUPABASE_ANON_KEY');
const pass = readFileSync('.supabase-dev-auth-password.local', 'utf8').trim();
const service = readFileSync('.supabase-dev-service-role.local', 'utf8').trim();

const admin = createClient(DEV_URL, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = createClient(DEV_URL, anon);

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function rpcViaRest(token, label) {
  const res = await fetch(`${DEV_URL}/rest/v1/rpc/ensure_community_membership_for_space_member`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_space_id: SPACE_ID,
      p_auth_user_id: '00000000-0000-0000-0000-000000000001',
    }),
  });
  const body = await res.text();
  return { label, status: res.status, body };
}

async function main() {
  const { error: serviceErr } = await admin.rpc('ensure_community_membership_for_space_member', {
    p_space_id: SPACE_ID,
    p_auth_user_id: '00000000-0000-0000-0000-000000000001',
  });
  record(
    'service_role RPC succeeds',
    !serviceErr,
    serviceErr?.message ?? 'ok',
  );

  const anonRes = await rpcViaRest(anon, 'anon');
  record(
    'anon RPC denied',
    anonRes.status === 401 || anonRes.status === 403 || /permission denied/i.test(anonRes.body),
    `status=${anonRes.status} body=${anonRes.body || '(empty)'}`,
  );

  const { error: signInErr } = await client.auth.signInWithPassword({
    email: 'dev-user-b@example.test',
    password: pass,
  });
  if (signInErr) throw signInErr;
  const session = (await client.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('authenticated session missing');

  const authRes = await rpcViaRest(session.access_token, 'authenticated');
  record(
    'authenticated RPC denied',
    authRes.status === 401 || authRes.status === 403 || /permission denied/i.test(authRes.body),
    `status=${authRes.status} body=${authRes.body || '(empty)'}`,
  );

  await client.auth.signOut();

  const { data: joinRow, error: joinErr } = await client.auth.signInWithPassword({
    email: 'dev-user-a@example.test',
    password: pass,
  });
  if (joinErr) throw joinErr;

  const { data: joined, error: joinRpcErr } = await client.rpc('join_space_as_member', {
    p_space_id: SPACE_ID,
  });
  record(
    'join_space_as_member still works (internal reconcile)',
    !joinRpcErr && joined?.status === 'active',
    joinRpcErr?.message ?? joined?.id,
  );
  await client.auth.signOut();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} RPC grant checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
