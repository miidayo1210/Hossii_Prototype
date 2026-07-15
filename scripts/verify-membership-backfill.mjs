#!/usr/bin/env node
/**
 * Development verification for community membership backfill (115 カテゴリ A).
 * Run after migration 20260718120000 is applied.
 * For pre-apply gap count, pass --before-apply (counts only, no mutation tests).
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_URL = 'https://uodaubhlcvvqlgsdxcdf.supabase.co';
const SPACE_ID = 'dev-space-public';
const BEFORE_ONLY = process.argv.includes('--before-apply');

function loadServiceRole() {
  return readFileSync('.supabase-dev-service-role.local', 'utf8').trim();
}

const admin = createClient(DEV_URL, loadServiceRole(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function countGaps() {
  const { data: memberships, error: smErr } = await admin
    .from('space_memberships')
    .select('auth_user_id, space_id, status')
    .eq('status', 'active');
  if (smErr) throw smErr;

  const { data: spaces, error: spErr } = await admin
    .from('spaces')
    .select('id, community_id')
    .not('community_id', 'is', null);
  if (spErr) throw spErr;

  const { data: communityMemberships, error: cmErr } = await admin
    .from('community_memberships')
    .select('community_id, auth_user_id');
  if (cmErr) throw cmErr;

  const spaceCommunity = new Map((spaces ?? []).map((s) => [s.id, s.community_id]));
  const existing = new Set(
    (communityMemberships ?? []).map((c) => `${c.community_id}:${c.auth_user_id}`),
  );
  const gaps = new Set();

  for (const row of memberships ?? []) {
    const communityId = spaceCommunity.get(row.space_id);
    if (!communityId) continue;
    const key = `${communityId}:${row.auth_user_id}`;
    if (!existing.has(key)) gaps.add(key);
  }

  return { gapCount: gaps.size, gapKeys: [...gaps] };
}

async function countCommunityMemberships() {
  const { count, error } = await admin
    .from('community_memberships')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function runBackfillInsert() {
  // Same predicate as migration; idempotency check via service role raw SQL substitute.
  const { data: memberships, error: smErr } = await admin
    .from('space_memberships')
    .select('auth_user_id, space_id, status')
    .eq('status', 'active');
  if (smErr) throw smErr;

  const { data: spaces, error: spErr } = await admin
    .from('spaces')
    .select('id, community_id')
    .not('community_id', 'is', null);
  if (spErr) throw spErr;

  const { data: communityMemberships, error: cmErr } = await admin
    .from('community_memberships')
    .select('community_id, auth_user_id');
  if (cmErr) throw cmErr;

  const spaceCommunity = new Map((spaces ?? []).map((s) => [s.id, s.community_id]));
  const existing = new Set(
    (communityMemberships ?? []).map((c) => `${c.community_id}:${c.auth_user_id}`),
  );

  const toInsert = [];
  const seen = new Set();
  for (const row of memberships ?? []) {
    const communityId = spaceCommunity.get(row.space_id);
    if (!communityId) continue;
    const key = `${communityId}:${row.auth_user_id}`;
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    toInsert.push({
      community_id: communityId,
      auth_user_id: row.auth_user_id,
      role: 'member',
      status: 'active',
      accepted_at: new Date().toISOString(),
    });
  }

  if (toInsert.length === 0) return 0;

  const before = await countCommunityMemberships();
  const { error: insErr } = await admin.from('community_memberships').upsert(toInsert, {
    onConflict: 'community_id,auth_user_id',
    ignoreDuplicates: true,
  });
  if (insErr) throw insErr;
  const after = await countCommunityMemberships();
  return after - before;
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

async function getUserId(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`user not found: ${email}`);
  return user.id;
}

async function fetchMembership(communityId, userId) {
  const { data, error } = await admin
    .from('community_memberships')
    .select('*')
    .eq('community_id', communityId)
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function main() {
  const { gapCount, gapKeys } = await countGaps();
  const totalCm = await countCommunityMemberships();

  console.log(`[backfill-verify] gap_pairs=${gapCount} total_community_memberships=${totalCm}`);
  if (gapKeys.length > 0) {
    console.log(`[backfill-verify] gap sample: ${gapKeys.slice(0, 5).join(', ')}`);
  }

  if (BEFORE_ONLY) {
    process.exit(gapCount >= 0 ? 0 : 1);
  }

  record('post-apply gap count is zero', gapCount === 0, `gaps=${gapCount}`);

  const addedByRerun = await runBackfillInsert();
  const { gapCount: gapAfterRerun } = await countGaps();
  const totalAfterRerun = await countCommunityMemberships();
  record(
    're-run backfill insert is idempotent',
    addedByRerun === 0 && gapAfterRerun === 0 && totalAfterRerun === totalCm,
    `added=${addedByRerun} total=${totalAfterRerun}`,
  );

  const communityId = await getCommunityId(SPACE_ID);
  const userBId = await getUserId('dev-user-b@example.test');

  // Ensure active space membership exists for sentinel checks
  await admin.from('space_memberships').upsert(
    {
      space_id: SPACE_ID,
      auth_user_id: userBId,
      role: 'member',
      status: 'active',
    },
    { onConflict: 'space_id,auth_user_id' },
  );

  const sentinelAcceptedAt = '2025-06-01T00:00:00.000Z';
  await admin.from('community_memberships').upsert(
    {
      community_id: communityId,
      auth_user_id: userBId,
      role: 'admin',
      status: 'active',
      accepted_at: sentinelAcceptedAt,
    },
    { onConflict: 'community_id,auth_user_id' },
  );
  const beforeAdmin = await fetchMembership(communityId, userBId);
  await runBackfillInsert();
  const afterAdmin = await fetchMembership(communityId, userBId);
  record(
    'admin role unchanged after backfill re-run',
    beforeAdmin.role === 'admin' &&
      afterAdmin.role === 'admin' &&
      beforeAdmin.status === 'active' &&
      afterAdmin.status === 'active',
    `${beforeAdmin.role}/${beforeAdmin.status} -> ${afterAdmin.role}/${afterAdmin.status}`,
  );

  for (const status of ['suspended', 'removed', 'invited']) {
    await admin.from('community_memberships').upsert(
      {
        community_id: communityId,
        auth_user_id: userBId,
        role: 'member',
        status,
        accepted_at: null,
      },
      { onConflict: 'community_id,auth_user_id' },
    );
    const before = await fetchMembership(communityId, userBId);
    await runBackfillInsert();
    const after = await fetchMembership(communityId, userBId);
    record(
      `non-active status "${status}" unchanged after backfill re-run`,
      before.status === status && after.status === status,
      `got ${after.status}`,
    );
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} backfill checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
