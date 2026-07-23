#!/usr/bin/env node
/**
 * Development verification for super_admin_create_community RPC + owner INSERT hardening.
 * Requires: migration applied, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const TEST_PREFIX = 'verify-super-admin-create-';

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
const createdCommunityIds = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(email) {
  const { error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
}

async function signOut() {
  await client.auth.signOut();
}

async function rpcViaRest(token, body) {
  const res = await fetch(`${DEV_URL}/rest/v1/rpc/super_admin_create_community`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep text
  }
  return { status: res.status, text, json };
}

async function getUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`user not found: ${email}`);
  return user.id;
}

async function cleanup() {
  if (createdCommunityIds.length === 0) return;
  const { error } = await admin.from('communities').delete().in('id', createdCommunityIds);
  if (error) {
    console.warn('[cleanup] delete communities failed:', error.message);
  } else {
    console.log(`[cleanup] removed ${createdCommunityIds.length} test communit(ies)`);
  }
}

async function main() {
  const superAdminId = await getUserId('dev-super-admin@example.test');
  const regularUserId = await getUserId('dev-user-a@example.test');

  // 1–4: super admin RPC success + row shape
  await signIn('dev-super-admin@example.test');
  const testName = `${TEST_PREFIX}${Date.now()}`;
  const { data: created, error: createErr } = await client.rpc('super_admin_create_community', {
    p_name: testName,
  });
  record(
    'super admin RPC succeeds',
    !createErr && !!created?.id,
    createErr?.message ?? created?.id,
  );
  if (created?.id) createdCommunityIds.push(created.id);

  record(
    'community status=approved',
    created?.status === 'approved',
    created?.status ?? '',
  );
  record(
    'admin_id matches caller',
    created?.admin_id === superAdminId,
    `${created?.admin_id ?? 'null'} vs ${superAdminId}`,
  );

  const { data: membership, error: membershipErr } = await admin
    .from('community_memberships')
    .select('role, status, auth_user_id')
    .eq('community_id', created?.id ?? '')
    .eq('auth_user_id', superAdminId)
    .maybeSingle();
  record(
    'membership admin/active exists',
    !membershipErr && membership?.role === 'admin' && membership?.status === 'active',
    membershipErr?.message ?? JSON.stringify(membership),
  );

  // 9: empty name rejected (same session)
  const { error: emptyErr } = await client.rpc('super_admin_create_community', { p_name: '   ' });
  record(
    'empty name rejected',
    !!emptyErr,
    emptyErr?.message ?? 'unexpected success',
  );

  // 10: slug uniqueness across two creates
  const nameTwo = `${TEST_PREFIX}uniq-${Date.now()}`;
  const { data: created2, error: create2Err } = await client.rpc('super_admin_create_community', {
    p_name: nameTwo,
  });
  if (created2?.id) createdCommunityIds.push(created2.id);
  record(
    'second RPC succeeds (slug uniqueness path)',
    !create2Err && !!created2?.slug,
    create2Err?.message ?? created2?.slug,
  );
  record(
    'generated slugs are unique',
    !!created?.slug && !!created2?.slug && created.slug !== created2.slug,
    `${created?.slug ?? '?'} vs ${created2?.slug ?? '?'}`,
  );

  await signOut();

  // 5: general user RPC denied
  await signIn('dev-user-a@example.test');
  const { error: userRpcErr } = await client.rpc('super_admin_create_community', {
    p_name: `${TEST_PREFIX}deny-${Date.now()}`,
  });
  record(
    'general user RPC denied',
    !!userRpcErr,
    userRpcErr?.message ?? 'unexpected success',
  );

  // 7: general user approved direct INSERT denied
  const { error: approvedInsertErr } = await client.from('communities').insert({
    admin_id: regularUserId,
    name: `${TEST_PREFIX}approved-insert-${Date.now()}`,
    slug: `zz${Date.now().toString(36).slice(-6)}`,
    status: 'approved',
  });
  record(
    'general user approved direct INSERT denied',
    !!approvedInsertErr,
    approvedInsertErr?.message ?? 'unexpected success',
  );

  // 8: general user pending INSERT success
  const pendingSlug = `pd${Date.now().toString(36).slice(-6)}`;
  const pendingName = `${TEST_PREFIX}pending-${Date.now()}`;
  const { data: pendingRow, error: pendingInsertErr } = await client
    .from('communities')
    .insert({
      admin_id: regularUserId,
      name: pendingName,
      slug: pendingSlug,
      status: 'pending',
    })
    .select('id, status')
    .single();
  if (pendingRow?.id) createdCommunityIds.push(pendingRow.id);
  record(
    'general user pending INSERT succeeds',
    !pendingInsertErr && pendingRow?.status === 'pending',
    pendingInsertErr?.message ?? JSON.stringify(pendingRow),
  );

  await signOut();

  // 6: unauthenticated denied
  const anonRes = await rpcViaRest(anon, { p_name: `${TEST_PREFIX}anon-${Date.now()}` });
  record(
    'unauthenticated RPC denied',
    anonRes.status === 401
      || anonRes.status === 403
      || /authentication required|permission denied|JWT/i.test(anonRes.text),
    `status=${anonRes.status} body=${anonRes.text || '(empty)'}`,
  );

  // 11: failure does not leave orphan community (empty name path)
  const { count: orphanCountBefore } = await admin
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .eq('name', '   ');
  await signIn('dev-super-admin@example.test');
  await client.rpc('super_admin_create_community', { p_name: '   ' });
  await signOut();
  const { count: orphanCountAfter } = await admin
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .eq('name', '   ');
  record(
    'failed RPC leaves no orphan community row',
    orphanCountBefore === orphanCountAfter,
    `before=${orphanCountBefore ?? 0} after=${orphanCountAfter ?? 0}`,
  );

  await cleanup();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} super_admin_create_community checks passed.`);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await cleanup();
  } catch {
    // ignore cleanup errors on crash
  }
  process.exit(1);
});
