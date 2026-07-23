#!/usr/bin/env node
/**
 * Development verification for communities.status self-approval guard (B-SA-SEC-1).
 * Requires: migration applied, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const TEST_PREFIX = 'verify-status-guard-';

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

function shortSlug(prefix) {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

async function signIn(email) {
  const { error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
}

async function signOut() {
  await client.auth.signOut();
}

async function getUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`user not found: ${email}`);
  return user.id;
}

async function fetchCommunity(id) {
  const { data, error } = await admin
    .from('communities')
    .select('id, name, slug, description, status, personal_space_template, admin_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`fetchCommunity: ${error.message}`);
  return data;
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
  const ownerId = await getUserId('dev-user-a@example.test');
  const otherOwnerId = await getUserId('dev-user-b@example.test');

  // Seed rows via service_role (JWT-less) so we control status without relying on seed data.
  const pendingSlug = shortSlug('sp');
  const approvedSlug = shortSlug('sa');
  const otherSlug = shortSlug('so');
  const stamp = Date.now();

  const { data: pendingRow, error: pendingInsertErr } = await admin
    .from('communities')
    .insert({
      admin_id: ownerId,
      name: `${TEST_PREFIX}pending-${stamp}`,
      slug: pendingSlug,
      description: 'initial-description',
      status: 'pending',
      personal_space_template: { enabled: false, name_pattern: 'before' },
    })
    .select('id')
    .single();
  if (pendingInsertErr || !pendingRow?.id) {
    throw new Error(`seed pending community failed: ${pendingInsertErr?.message}`);
  }
  createdCommunityIds.push(pendingRow.id);

  const { data: approvedRow, error: approvedInsertErr } = await admin
    .from('communities')
    .insert({
      admin_id: ownerId,
      name: `${TEST_PREFIX}approved-${stamp}`,
      slug: approvedSlug,
      description: 'approved-description',
      status: 'approved',
    })
    .select('id')
    .single();
  if (approvedInsertErr || !approvedRow?.id) {
    throw new Error(`seed approved community failed: ${approvedInsertErr?.message}`);
  }
  createdCommunityIds.push(approvedRow.id);

  const { data: otherRow, error: otherInsertErr } = await admin
    .from('communities')
    .insert({
      admin_id: otherOwnerId,
      name: `${TEST_PREFIX}other-${stamp}`,
      slug: otherSlug,
      status: 'pending',
    })
    .select('id, name')
    .single();
  if (otherInsertErr || !otherRow?.id) {
    throw new Error(`seed other community failed: ${otherInsertErr?.message}`);
  }
  createdCommunityIds.push(otherRow.id);

  await signIn('dev-user-a@example.test');

  // 1. owner name update succeeds
  const nextName = `${TEST_PREFIX}renamed-${stamp}`;
  const { error: nameErr } = await client
    .from('communities')
    .update({ name: nextName })
    .eq('id', pendingRow.id);
  const afterName = await fetchCommunity(pendingRow.id);
  record(
    'owner name update succeeds',
    !nameErr && afterName?.name === nextName && afterName?.status === 'pending',
    nameErr?.message ?? afterName?.name,
  );

  // 2. owner description update succeeds
  const nextDescription = `desc-${stamp}`;
  const { error: descErr } = await client
    .from('communities')
    .update({ description: nextDescription })
    .eq('id', pendingRow.id);
  const afterDesc = await fetchCommunity(pendingRow.id);
  record(
    'owner description update succeeds',
    !descErr && afterDesc?.description === nextDescription && afterDesc?.status === 'pending',
    descErr?.message ?? afterDesc?.description,
  );

  // 3. owner slug update succeeds
  const nextSlug = shortSlug('nu');
  const { error: slugErr } = await client
    .from('communities')
    .update({ slug: nextSlug })
    .eq('id', pendingRow.id);
  const afterSlug = await fetchCommunity(pendingRow.id);
  record(
    'owner slug update succeeds',
    !slugErr && afterSlug?.slug === nextSlug && afterSlug?.status === 'pending',
    slugErr?.message ?? afterSlug?.slug,
  );

  // 4. owner personal_space_template update succeeds
  const nextTemplate = { enabled: true, name_pattern: `after-${stamp}` };
  const { error: templateErr } = await client
    .from('communities')
    .update({ personal_space_template: nextTemplate })
    .eq('id', pendingRow.id);
  const afterTemplate = await fetchCommunity(pendingRow.id);
  record(
    'owner personal_space_template update succeeds',
    !templateErr
      && afterTemplate?.personal_space_template?.enabled === true
      && afterTemplate?.personal_space_template?.name_pattern === nextTemplate.name_pattern
      && afterTemplate?.status === 'pending',
    templateErr?.message ?? JSON.stringify(afterTemplate?.personal_space_template),
  );

  // Snapshot before denied status mutations (for atomicity + status checks)
  const beforeDenied = await fetchCommunity(pendingRow.id);

  // 5. owner pending → approved denied
  const { data: p2aData, error: p2aErr } = await client
    .from('communities')
    .update({ status: 'approved' })
    .eq('id', pendingRow.id)
    .select('id');
  const afterP2a = await fetchCommunity(pendingRow.id);
  record(
    'owner pending→approved denied',
    !!p2aErr && afterP2a?.status === 'pending' && (!p2aData || p2aData.length === 0),
    p2aErr?.message ?? `status=${afterP2a?.status}`,
  );

  // 6. owner pending → rejected denied
  const { data: p2rData, error: p2rErr } = await client
    .from('communities')
    .update({ status: 'rejected' })
    .eq('id', pendingRow.id)
    .select('id');
  const afterP2r = await fetchCommunity(pendingRow.id);
  record(
    'owner pending→rejected denied',
    !!p2rErr && afterP2r?.status === 'pending' && (!p2rData || p2rData.length === 0),
    p2rErr?.message ?? `status=${afterP2r?.status}`,
  );

  // 7. owner approved → pending denied
  const { data: a2pData, error: a2pErr } = await client
    .from('communities')
    .update({ status: 'pending' })
    .eq('id', approvedRow.id)
    .select('id');
  const afterA2p = await fetchCommunity(approvedRow.id);
  record(
    'owner approved→pending denied',
    !!a2pErr && afterA2p?.status === 'approved' && (!a2pData || a2pData.length === 0),
    a2pErr?.message ?? `status=${afterA2p?.status}`,
  );

  // 11. failed status change does not update other columns
  const poisonedName = `${TEST_PREFIX}poisoned-${stamp}`;
  const { error: poisonErr } = await client
    .from('communities')
    .update({ name: poisonedName, status: 'approved' })
    .eq('id', pendingRow.id);
  const afterPoison = await fetchCommunity(pendingRow.id);
  record(
    'failed status change leaves other columns unchanged',
    !!poisonErr
      && afterPoison?.status === 'pending'
      && afterPoison?.name === beforeDenied?.name
      && afterPoison?.name !== poisonedName,
    poisonErr?.message
      ?? `name=${afterPoison?.name} status=${afterPoison?.status}`,
  );

  // 9. unrelated community update not allowed (RLS: 0 rows)
  const { data: unrelatedData, error: unrelatedErr } = await client
    .from('communities')
    .update({ name: `${TEST_PREFIX}hijack-${stamp}` })
    .eq('id', otherRow.id)
    .select('id');
  const afterUnrelated = await fetchCommunity(otherRow.id);
  record(
    'unrelated community update denied',
    !unrelatedErr
      && (!unrelatedData || unrelatedData.length === 0)
      && afterUnrelated?.name === otherRow.name,
    unrelatedErr?.message ?? `rows=${unrelatedData?.length ?? 0} name=${afterUnrelated?.name}`,
  );

  await signOut();

  // 8. super admin status change succeeds
  await signIn('dev-super-admin@example.test');
  const { data: saData, error: saErr } = await client
    .from('communities')
    .update({ status: 'approved' })
    .eq('id', pendingRow.id)
    .select('id, status');
  const afterSa = await fetchCommunity(pendingRow.id);
  record(
    'super admin status change succeeds',
    !saErr && afterSa?.status === 'approved' && saData?.[0]?.status === 'approved',
    saErr?.message ?? afterSa?.status,
  );
  await signOut();

  // Reset to pending via service_role for the next check clarity, then flip again
  await admin.from('communities').update({ status: 'pending' }).eq('id', pendingRow.id);

  // 10. service_role status change succeeds
  const { data: svcData, error: svcErr } = await admin
    .from('communities')
    .update({ status: 'rejected' })
    .eq('id', pendingRow.id)
    .select('id, status');
  const afterSvc = await fetchCommunity(pendingRow.id);
  record(
    'service_role status change succeeds',
    !svcErr && afterSvc?.status === 'rejected' && svcData?.[0]?.status === 'rejected',
    svcErr?.message ?? afterSvc?.status,
  );

  // 12. cleanup
  await cleanup();
  const { count: leftover } = await admin
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .in('id', createdCommunityIds);
  record(
    'cleanup removes test communities',
    (leftover ?? 0) === 0,
    `leftover=${leftover ?? 0}`,
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} communities.status guard checks passed.`);
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
