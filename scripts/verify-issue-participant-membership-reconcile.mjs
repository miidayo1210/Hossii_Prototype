#!/usr/bin/env node
/**
 * Development integration checks for issue-participant-account membership reconcile (115).
 * Requires: migrations applied, Edge Function deployed to Development, credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const SPACE_ID = 'dev-space-public';
const NULL_COMMUNITY_SPACE_ID = 'reconcile-test-null-community';

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
const issuedSlots = [];

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

async function getCommunityId(spaceId) {
  const { data, error } = await admin
    .from('spaces')
    .select('community_id')
    .eq('id', spaceId)
    .maybeSingle();
  if (error) throw error;
  return data?.community_id ?? null;
}

async function findFreeSlot(spaceId) {
  const { data, error } = await admin
    .from('space_participant_accounts')
    .select('slot_number')
    .eq('space_id', spaceId);
  if (error) throw error;
  const used = new Set((data ?? []).map((row) => row.slot_number));
  for (let slot = 1; slot <= 20; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  throw new Error(`no free participant slot on ${spaceId}`);
}

async function invokeIssue(
  spaceId,
  slotNumber,
  { linkCommunityMembership = false, linkSpaceMembership = false } = {},
) {
  const { data, error } = await client.functions.invoke('issue-participant-account', {
    body: {
      spaceId,
      action: 'issue',
      slotNumber,
      linkCommunityMembership,
      linkSpaceMembership,
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
}

async function revokeSlot(spaceId, slotNumber) {
  const { error } = await client.functions.invoke('issue-participant-account', {
    body: { spaceId, action: 'revoke', slotNumber },
  });
  if (error) console.warn(`revoke slot ${slotNumber}: ${error.message}`);
}

async function fetchParticipantAuthUserId(spaceId, slotNumber) {
  const { data, error } = await admin
    .from('space_participant_accounts')
    .select('auth_user_id')
    .eq('space_id', spaceId)
    .eq('slot_number', slotNumber)
    .maybeSingle();
  if (error) throw error;
  return data?.auth_user_id ?? null;
}

async function fetchCommunityMembership(communityId, userId) {
  const { data, error } = await admin
    .from('community_memberships')
    .select('*')
    .eq('community_id', communityId)
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertCommunityMembership(row) {
  const { error } = await admin.from('community_memberships').upsert(row, {
    onConflict: 'community_id,auth_user_id',
  });
  if (error) throw error;
}

async function callEnsure(spaceId, userId) {
  const { error } = await admin.rpc('ensure_community_membership_for_space_member', {
    p_space_id: spaceId,
    p_auth_user_id: userId,
  });
  return error;
}

async function ensureNullCommunitySpace() {
  const { error } = await admin.from('spaces').upsert({
    id: NULL_COMMUNITY_SPACE_ID,
    name: 'Reconcile Null Community',
    space_url: 'reconcile-null-community',
    community_id: null,
    space_type: 'shared',
    access_mode: 'public',
    is_private: false,
    background: { kind: 'color', value: '#FFFFFF' },
  });
  if (error) throw error;
}

async function main() {
  const communityId = await getCommunityId(SPACE_ID);
  if (!communityId) throw new Error('dev-space-public has no community_id');
  await ensureNullCommunitySpace();

  await signIn('dev-community-admin@example.test');
  const adminUserId = (await client.auth.getUser()).data.user?.id;
  if (!adminUserId) throw new Error('admin user id missing');

  // space link ON creates community membership
  const slotOn = await findFreeSlot(SPACE_ID);
  issuedSlots.push({ spaceId: SPACE_ID, slot: slotOn });
  const issueOn = await invokeIssue(SPACE_ID, slotOn, { linkSpaceMembership: true });
  const userOn = await fetchParticipantAuthUserId(SPACE_ID, slotOn);
  const cmOn = await fetchCommunityMembership(communityId, userOn);
  record(
    'space link ON creates community membership',
    cmOn?.role === 'member' && cmOn?.status === 'active',
    cmOn ? `${cmOn.role}/${cmOn.status}` : 'missing',
  );

  // response format unchanged
  record(
    'response format preserved (loginId/password/slotNumber)',
    typeof issueOn.loginId === 'string' &&
      typeof issueOn.password === 'string' &&
      issueOn.slotNumber === slotOn,
    JSON.stringify({ loginId: issueOn.loginId, slotNumber: issueOn.slotNumber }),
  );

  // idempotent re-run via ensure RPC (same path Edge Function uses)
  await callEnsure(SPACE_ID, userOn);
  const { count: cmCount, error: countErr } = await admin
    .from('community_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('auth_user_id', userOn);
  if (countErr) throw countErr;
  record('reconcile re-run does not duplicate', cmCount === 1, `count=${cmCount}`);

  // space link OFF does not create community membership
  const slotOff = await findFreeSlot(SPACE_ID);
  issuedSlots.push({ spaceId: SPACE_ID, slot: slotOff });
  await invokeIssue(SPACE_ID, slotOff, { linkSpaceMembership: false });
  const userOff = await fetchParticipantAuthUserId(SPACE_ID, slotOff);
  const cmOff = await fetchCommunityMembership(communityId, userOff);
  record(
    'space link OFF does not create community membership',
    cmOff === null,
    cmOff ? `unexpected ${cmOff.status}` : 'ok',
  );

  // explicit community link behavior preserved
  const slotCommunity = await findFreeSlot(SPACE_ID);
  issuedSlots.push({ spaceId: SPACE_ID, slot: slotCommunity });
  await invokeIssue(SPACE_ID, slotCommunity, {
    linkCommunityMembership: true,
    linkSpaceMembership: false,
  });
  const userCommunity = await fetchParticipantAuthUserId(SPACE_ID, slotCommunity);
  const cmExplicit = await fetchCommunityMembership(communityId, userCommunity);
  record(
    'explicit community link creates active membership with invited_by',
    cmExplicit?.status === 'active' && cmExplicit?.invited_by === adminUserId,
    cmExplicit
      ? `status=${cmExplicit.status} invited_by=${cmExplicit.invited_by}`
      : 'missing',
  );

  // non-active statuses unchanged (simulate post-issue reconcile)
  const slotStatus = await findFreeSlot(SPACE_ID);
  issuedSlots.push({ spaceId: SPACE_ID, slot: slotStatus });
  await invokeIssue(SPACE_ID, slotStatus, { linkSpaceMembership: true });
  const userStatus = await fetchParticipantAuthUserId(SPACE_ID, slotStatus);
  await admin
    .from('community_memberships')
    .delete()
    .eq('community_id', communityId)
    .eq('auth_user_id', userStatus);
  for (const status of ['suspended', 'removed', 'invited']) {
    await upsertCommunityMembership({
      community_id: communityId,
      auth_user_id: userStatus,
      role: 'member',
      status,
    });
    await callEnsure(SPACE_ID, userStatus);
    const row = await fetchCommunityMembership(communityId, userStatus);
    record(
      `non-active status "${status}" unchanged after reconcile`,
      row?.status === status,
      `got ${row?.status ?? 'none'}`,
    );
  }

  // admin role not downgraded
  await upsertCommunityMembership({
    community_id: communityId,
    auth_user_id: userStatus,
    role: 'admin',
    status: 'active',
    accepted_at: '2026-01-01T00:00:00.000Z',
  });
  await callEnsure(SPACE_ID, userStatus);
  const afterAdmin = await fetchCommunityMembership(communityId, userStatus);
  record(
    'existing admin role not downgraded',
    afterAdmin?.role === 'admin' && afterAdmin?.status === 'active',
    `${afterAdmin?.role}/${afterAdmin?.status}`,
  );

  await signOut();

  // null community_id space: super_admin can issue; reconcile must not create membership
  await signIn('dev-super-admin@example.test');
  const nullSlot = await findFreeSlot(NULL_COMMUNITY_SPACE_ID);
  issuedSlots.push({ spaceId: NULL_COMMUNITY_SPACE_ID, slot: nullSlot });
  await invokeIssue(NULL_COMMUNITY_SPACE_ID, nullSlot, { linkSpaceMembership: true });
  const nullUser = await fetchParticipantAuthUserId(NULL_COMMUNITY_SPACE_ID, nullSlot);
  const { data: anyCm, error: anyCmErr } = await admin
    .from('community_memberships')
    .select('id')
    .eq('auth_user_id', nullUser);
  if (anyCmErr) throw anyCmErr;
  record(
    'null community_id does not create community membership',
    (anyCm ?? []).length === 0,
    `rows=${(anyCm ?? []).length}`,
  );
  await revokeSlot(NULL_COMMUNITY_SPACE_ID, nullSlot);
  await signOut();

  // cleanup
  await signIn('dev-community-admin@example.test');
  for (const { spaceId, slot } of issuedSlots) {
    if (spaceId === NULL_COMMUNITY_SPACE_ID) continue;
    await revokeSlot(spaceId, slot);
  }
  await signOut();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} issue-participant reconcile checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
