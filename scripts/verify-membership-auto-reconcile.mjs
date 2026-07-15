#!/usr/bin/env node
/**
 * Development Supabase integration checks for membership auto-reconcile (115).
 * Requires: migration applied, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const SPACE_ID = 'dev-space-public';
const OTHER_SPACE_ID = 'dev-space-my-on';
const NULL_COMMUNITY_SPACE_ID = 'reconcile-test-null-community';
const OTHER_COMMUNITY_SPACE_ID = 'reconcile-test-other-community';

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

async function getCommunityIdForSpace(spaceId) {
  const { data, error } = await admin
    .from('spaces')
    .select('community_id')
    .eq('id', spaceId)
    .maybeSingle();
  if (error) throw error;
  return data?.community_id ?? null;
}

async function deleteCommunityMembership(communityId, userId) {
  const { error } = await admin
    .from('community_memberships')
    .delete()
    .eq('community_id', communityId)
    .eq('auth_user_id', userId);
  if (error) throw error;
}

async function deleteSpaceMembership(spaceId, userId) {
  const { error } = await admin
    .from('space_memberships')
    .delete()
    .eq('space_id', spaceId)
    .eq('auth_user_id', userId);
  if (error) throw error;
}

async function upsertCommunityMembership(row) {
  const { error } = await admin.from('community_memberships').upsert(row, {
    onConflict: 'community_id,auth_user_id',
  });
  if (error) throw error;
}

async function upsertSpaceMembership(row) {
  const { error } = await admin.from('space_memberships').upsert(row, {
    onConflict: 'space_id,auth_user_id',
  });
  if (error) throw error;
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

async function callEnsure(spaceId, userId) {
  const { error } = await admin.rpc('ensure_community_membership_for_space_member', {
    p_space_id: spaceId,
    p_auth_user_id: userId,
  });
  return error;
}

async function ensureTestSpaces(communityId, otherCommunityId) {
  const { error: nullSpaceErr } = await admin.from('spaces').upsert({
    id: NULL_COMMUNITY_SPACE_ID,
    name: 'Reconcile Null Community',
    space_url: 'reconcile-null-community',
    community_id: null,
    space_type: 'shared',
    access_mode: 'public',
    is_private: false,
    background: { kind: 'color', value: '#FFFFFF' },
  });
  if (nullSpaceErr) throw nullSpaceErr;

  const { error: otherSpaceErr } = await admin.from('spaces').upsert({
    id: OTHER_COMMUNITY_SPACE_ID,
    name: 'Reconcile Other Community',
    space_url: 'reconcile-other-community',
    community_id: otherCommunityId,
    space_type: 'shared',
    access_mode: 'public',
    is_private: false,
    background: { kind: 'color', value: '#FFFFFF' },
  });
  if (otherSpaceErr) throw otherSpaceErr;

  const { error: settingsErr } = await admin.from('space_settings').upsert([
    { space_id: NULL_COMMUNITY_SPACE_ID },
    { space_id: OTHER_COMMUNITY_SPACE_ID },
  ]);
  if (settingsErr) throw settingsErr;
}

async function ensureOtherCommunity(adminUserId) {
  const slug = `reconcile-other-${Date.now()}`;
  const { data, error } = await admin
    .from('communities')
    .insert({
      admin_id: adminUserId,
      name: 'Reconcile Other Community',
      slug,
      status: 'approved',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const userBId = await getUserId('dev-user-b@example.test');
  const adminUserId = await getUserId('dev-community-admin@example.test');
  const communityId = await getCommunityIdForSpace(SPACE_ID);
  if (!communityId) throw new Error('dev-space-public has no community_id');

  const otherCommunityId = await ensureOtherCommunity(adminUserId);
  await ensureTestSpaces(communityId, otherCommunityId);

  // Clean slate for user B on primary space
  await deleteSpaceMembership(SPACE_ID, userBId);
  await deleteCommunityMembership(communityId, userBId);

  await signIn('dev-user-b@example.test');
  const { data: joinRow, error: joinErr } = await client.rpc('join_space_as_member', {
    p_space_id: SPACE_ID,
    p_space_nickname: 'Reconcile Test',
  });
  record(
    'join creates active space membership',
    !joinErr && joinRow?.status === 'active' && joinRow?.role === 'member',
    joinErr?.message ?? JSON.stringify(joinRow),
  );

  const cmAfterJoin = await fetchCommunityMembership(communityId, userBId);
  record(
    'join creates community membership (member/active)',
    cmAfterJoin?.role === 'member' && cmAfterJoin?.status === 'active',
    cmAfterJoin ? `${cmAfterJoin.role}/${cmAfterJoin.status}` : 'missing',
  );

  const { data: joinAgain, error: joinAgainErr } = await client.rpc('join_space_as_member', {
    p_space_id: SPACE_ID,
  });
  const cmAfterRejoin = await fetchCommunityMembership(communityId, userBId);
  const { count: cmCount, error: countErr } = await admin
    .from('community_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('community_id', communityId)
    .eq('auth_user_id', userBId);
  if (countErr) throw countErr;
  record(
    're-join is idempotent (no duplicate community membership)',
    !joinAgainErr && cmCount === 1 && joinAgain?.auth_user_id === userBId,
    `count=${cmCount}`,
  );
  await signOut();

  // Existing active membership unchanged
  await deleteSpaceMembership(SPACE_ID, userBId);
  const acceptedAt = '2026-01-01T00:00:00.000Z';
  await upsertCommunityMembership({
    community_id: communityId,
    auth_user_id: userBId,
    role: 'member',
    status: 'active',
    accepted_at: acceptedAt,
  });
  await upsertSpaceMembership({
    space_id: SPACE_ID,
    auth_user_id: userBId,
    role: 'member',
    status: 'active',
  });
  const beforeActive = await fetchCommunityMembership(communityId, userBId);
  await callEnsure(SPACE_ID, userBId);
  const afterActive = await fetchCommunityMembership(communityId, userBId);
  record(
    'existing active membership unchanged',
    beforeActive.accepted_at === afterActive.accepted_at &&
      beforeActive.role === 'member' &&
      afterActive.status === 'active',
    `accepted_at ${beforeActive.accepted_at} -> ${afterActive.accepted_at}`,
  );

  // Admin role not downgraded
  await upsertCommunityMembership({
    community_id: communityId,
    auth_user_id: userBId,
    role: 'admin',
    status: 'active',
    accepted_at: acceptedAt,
  });
  await callEnsure(SPACE_ID, userBId);
  const afterAdmin = await fetchCommunityMembership(communityId, userBId);
  record(
    'existing admin role not downgraded',
    afterAdmin.role === 'admin' && afterAdmin.status === 'active',
    `${afterAdmin.role}/${afterAdmin.status}`,
  );

  for (const status of ['suspended', 'removed', 'invited']) {
    await upsertCommunityMembership({
      community_id: communityId,
      auth_user_id: userBId,
      role: 'member',
      status,
      accepted_at: null,
    });
    await callEnsure(SPACE_ID, userBId);
    const row = await fetchCommunityMembership(communityId, userBId);
    record(
      `non-active status "${status}" unchanged`,
      row.status === status,
      `got ${row.status}`,
    );
  }

  // Null community_id space
  await deleteCommunityMembership(communityId, userBId);
  await deleteSpaceMembership(NULL_COMMUNITY_SPACE_ID, userBId);
  await upsertSpaceMembership({
    space_id: NULL_COMMUNITY_SPACE_ID,
    auth_user_id: userBId,
    role: 'member',
    status: 'active',
  });
  await callEnsure(NULL_COMMUNITY_SPACE_ID, userBId);
  const nullCm = await fetchCommunityMembership(communityId, userBId);
  record(
    'null community_id space creates no membership',
    nullCm === null,
    nullCm ? `unexpected ${nullCm.status}` : 'ok',
  );

  // Non-active space_membership
  await deleteSpaceMembership(SPACE_ID, userBId);
  await deleteCommunityMembership(communityId, userBId);
  await upsertSpaceMembership({
    space_id: SPACE_ID,
    auth_user_id: userBId,
    role: 'member',
    status: 'suspended',
  });
  await callEnsure(SPACE_ID, userBId);
  const noActiveSm = await fetchCommunityMembership(communityId, userBId);
  record(
    'non-active space_membership creates no community membership',
    noActiveSm === null,
    noActiveSm ? 'unexpected row' : 'ok',
  );

  // Other community unaffected
  await deleteCommunityMembership(otherCommunityId, userBId);
  await deleteSpaceMembership(OTHER_COMMUNITY_SPACE_ID, userBId);
  await upsertSpaceMembership({
    space_id: SPACE_ID,
    auth_user_id: userBId,
    role: 'member',
    status: 'active',
  });
  await callEnsure(SPACE_ID, userBId);
  const primaryCm = await fetchCommunityMembership(communityId, userBId);
  const otherCm = await fetchCommunityMembership(otherCommunityId, userBId);
  record(
    'other community unaffected',
    primaryCm !== null && otherCm === null,
    `primary=${primaryCm?.status ?? 'none'} other=${otherCm?.status ?? 'none'}`,
  );

  // join_space_as_member existing behavior: returns row, blocks invite_only
  await deleteSpaceMembership(SPACE_ID, userBId);
  await deleteCommunityMembership(communityId, userBId);
  await signIn('dev-user-b@example.test');
  const { data: finalJoin, error: finalJoinErr } = await client.rpc('join_space_as_member', {
    p_space_id: SPACE_ID,
    p_space_nickname: 'Final',
  });
  record(
    'join returns space_memberships row',
    !finalJoinErr && finalJoin?.space_id === SPACE_ID && finalJoin?.space_nickname === 'Final',
    finalJoinErr?.message ?? finalJoin?.id,
  );

  await deleteSpaceMembership(OTHER_SPACE_ID, userBId);
  await admin.from('spaces').update({ access_mode: 'invite_only' }).eq('id', OTHER_SPACE_ID);
  const { error: blockedJoinErr } = await client.rpc('join_space_as_member', {
    p_space_id: OTHER_SPACE_ID,
  });
  await admin.from('spaces').update({ access_mode: 'public' }).eq('id', OTHER_SPACE_ID);
  record(
    'join still blocks invite_only shared space',
    !!blockedJoinErr && blockedJoinErr.message.includes('self-join not allowed'),
    blockedJoinErr?.message ?? 'unexpected success',
  );
  await signOut();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} membership reconcile checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
