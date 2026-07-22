#!/usr/bin/env node
/**
 * Development Supabase RLS coverage for hossii_connections (126 Phase 1).
 * Extends verify-hossii-connections.mjs with read-path and guard edge cases.
 * Requires: migration on dev, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const SPACE_PUBLIC = 'dev-space-public';
const SPACE_PRIVATE = 'dev-space-private';
const SPACE_INVITE = 'dev-space-my-on';
const PANE_PUBLIC = `${SPACE_PUBLIC}-pane-default`;
const PANE_PRIVATE = `${SPACE_PRIVATE}-pane-default`;
const PANE_INVITE = `${SPACE_INVITE}-pane-default`;
const HOSSII_PUBLIC_A = 'dev-post-001';
const HOSSII_PUBLIC_B = 'dev-post-002';
const HOSSII_PUBLIC_ADMIN = 'dev-post-003';
const HOSSII_OTHER_SPACE = 'dev-post-004';
const HOSSII_INVITE = 'dev-post-006';
const BLOCKED = 'このスペースはアーカイブされているため変更できません';

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
const createdConnectionIds = [];
const tempHossiiIds = [];
let extraPaneId = null;
let publicConnectionId = null;
let ownerOnlyConnectionId = null;
let archivedProbeConnectionId = null;

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

async function ensureUnarchived(spaceId) {
  await signIn('dev-community-admin@example.test');
  const { error } = await client.rpc('set_space_archived', {
    p_space_id: spaceId,
    p_archived: false,
  });
  await signOut();
  if (error) throw new Error(`ensureUnarchived ${spaceId}: ${error.message}`);
}

async function cleanupConnections() {
  if (createdConnectionIds.length > 0) {
    await admin.from('hossii_connections').delete().in('id', createdConnectionIds);
    createdConnectionIds.length = 0;
  }
}

async function cleanupTempHossiis() {
  if (tempHossiiIds.length === 0) return;
  for (const id of tempHossiiIds) {
    await admin
      .from('hossii_connections')
      .delete()
      .or(`source_hossii_id.eq.${id},target_hossii_id.eq.${id}`);
  }
  await admin.from('hossiis').delete().in('id', tempHossiiIds);
  tempHossiiIds.length = 0;
}

async function ensureExtraPane() {
  extraPaneId = `${SPACE_PUBLIC}-pane-rls-test`;
  const { error } = await admin.from('space_panes').upsert(
    {
      id: extraPaneId,
      space_id: SPACE_PUBLIC,
      name: 'RLS Test',
      slug: 'rls-test',
      sort_order: 98,
      is_default: false,
      is_visible: true,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`ensureExtraPane: ${error.message}`);
}

async function ensurePaneAssignments() {
  for (const [id, paneId] of [
    [HOSSII_PUBLIC_A, PANE_PUBLIC],
    [HOSSII_PUBLIC_B, PANE_PUBLIC],
    [HOSSII_PUBLIC_ADMIN, PANE_PUBLIC],
    [HOSSII_OTHER_SPACE, 'dev-space-motion-pane-default'],
    [HOSSII_INVITE, PANE_INVITE],
  ]) {
    const { error } = await admin
      .from('hossiis')
      .update({ space_pane_id: paneId, is_hidden: false, deleted_at: null })
      .eq('id', id);
    if (error) throw new Error(`assign pane ${id}: ${error.message}`);
  }
}

async function seedConnection(payload) {
  const { data, error } = await admin
    .from('hossii_connections')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(`seedConnection: ${error.message}`);
  createdConnectionIds.push(data.id);
  return data;
}

async function main() {
  await ensureUnarchived(SPACE_PUBLIC);
  await ensurePaneAssignments();
  await ensureExtraPane();
  await cleanupConnections();
  await cleanupTempHossiis();

  const publicConn = await seedConnection({
    space_id: SPACE_PUBLIC,
    pane_id: PANE_PUBLIC,
    source_hossii_id: HOSSII_PUBLIC_A,
    target_hossii_id: HOSSII_PUBLIC_B,
    strength: 'medium',
  });
  publicConnectionId = publicConn.id;

  await signOut();
  const { data: anonPublicRows, error: anonPublicErr } = await client
    .from('hossii_connections')
    .select('id')
    .eq('space_id', SPACE_PUBLIC)
    .eq('pane_id', PANE_PUBLIC);
  record(
    'anon reads public-space public-endpoint connections',
    !anonPublicErr && (anonPublicRows ?? []).some((row) => row.id === publicConnectionId),
    anonPublicErr?.message ?? `count=${anonPublicRows?.length ?? 0}`,
  );

  const privateTargetId = `rls-private-b-${Date.now()}`;
  await admin.from('hossiis').insert({
    id: privateTargetId,
    message: 'private space rls target',
    space_id: SPACE_PRIVATE,
    space_pane_id: PANE_PRIVATE,
    author_name: 'Admin',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  tempHossiiIds.push(privateTargetId);
  const { data: privateConnection, error: privateSetupErr } = await admin
    .from('hossii_connections')
    .insert({
      space_id: SPACE_PRIVATE,
      pane_id: PANE_PRIVATE,
      source_hossii_id: 'dev-post-007',
      target_hossii_id: privateTargetId,
      strength: 'soft',
    })
    .select('id')
    .single();
  if (privateSetupErr) throw new Error(`private connection setup: ${privateSetupErr.message}`);
  createdConnectionIds.push(privateConnection.id);

  const prevPrivateMode = (
    await admin.from('spaces').select('access_mode').eq('id', SPACE_PRIVATE).single()
  ).data?.access_mode ?? 'public';
  await admin.from('spaces').update({ access_mode: 'invite_only' }).eq('id', SPACE_PRIVATE);

  await signOut();
  const { data: anonPrivateRows, error: anonPrivateErr } = await client
    .from('hossii_connections')
    .select('id')
    .eq('space_id', SPACE_PRIVATE);
  record(
    'anon blocked from private-space connections',
    !anonPrivateErr && (anonPrivateRows ?? []).length === 0,
    anonPrivateErr?.message ?? `count=${anonPrivateRows?.length ?? 0}`,
  );
  await admin.from('spaces').update({ access_mode: prevPrivateMode }).eq('id', SPACE_PRIVATE);

  const prevInviteMode = (
    await admin.from('spaces').select('access_mode').eq('id', SPACE_INVITE).single()
  ).data?.access_mode ?? 'public';
  await admin.from('spaces').update({ access_mode: 'invite_only' }).eq('id', SPACE_INVITE);

  const inviteTargetId = `rls-invite-b-${Date.now()}`;
  await admin.from('hossiis').insert({
    id: inviteTargetId,
    message: 'invite space rls target',
    space_id: SPACE_INVITE,
    space_pane_id: PANE_INVITE,
    author_name: 'Admin',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  tempHossiiIds.push(inviteTargetId);
  const { data: inviteConnection, error: inviteSetupErr } = await admin
    .from('hossii_connections')
    .insert({
      space_id: SPACE_INVITE,
      pane_id: PANE_INVITE,
      source_hossii_id: HOSSII_INVITE,
      target_hossii_id: inviteTargetId,
      strength: 'soft',
    })
    .select('id')
    .single();
  if (inviteSetupErr) throw new Error(`invite connection setup: ${inviteSetupErr.message}`);
  createdConnectionIds.push(inviteConnection.id);

  await signOut();
  const { data: anonInviteRows, error: anonInviteErr } = await client
    .from('hossii_connections')
    .select('id')
    .eq('space_id', SPACE_INVITE);
  record(
    'anon blocked from invite_only space connections',
    !anonInviteErr && (anonInviteRows ?? []).length === 0,
    anonInviteErr?.message ?? `count=${anonInviteRows?.length ?? 0}`,
  );
  await admin.from('spaces').update({ access_mode: prevInviteMode }).eq('id', SPACE_INVITE);

  const ownerOnlyPostId = `rls-owner-only-${Date.now()}`;
  await signIn('dev-user-a@example.test');
  const { error: ownerSeedErr } = await client.from('hossiis').insert({
    id: ownerOnlyPostId,
    message: 'owner only endpoint',
    space_id: SPACE_PUBLIC,
    space_pane_id: PANE_PUBLIC,
    author_name: 'Dev User A',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  if (ownerSeedErr) throw new Error(`owner only seed: ${ownerSeedErr.message}`);
  tempHossiiIds.push(ownerOnlyPostId);
  const { error: visErr } = await client.rpc('set_my_hossii_visibility', {
    p_hossii_id: ownerOnlyPostId,
    p_visibility: 'owner_only',
  });
  if (visErr) throw new Error(`set owner_only: ${visErr.message}`);
  await signOut();

  const ownerConn = await seedConnection({
    space_id: SPACE_PUBLIC,
    pane_id: PANE_PUBLIC,
    source_hossii_id: HOSSII_PUBLIC_ADMIN,
    target_hossii_id: ownerOnlyPostId,
    strength: 'strong',
  });
  ownerOnlyConnectionId = ownerConn.id;

  await signIn('dev-user-b@example.test');
  const { data: memberBRows, error: memberBErr } = await client
    .from('hossii_connections')
    .select('id')
    .eq('space_id', SPACE_PUBLIC)
    .eq('pane_id', PANE_PUBLIC);
  record(
    'member cannot read connection with others owner_only endpoint',
    !memberBErr && !(memberBRows ?? []).some((row) => row.id === ownerOnlyConnectionId),
    memberBErr?.message ?? `ids=${(memberBRows ?? []).map((r) => r.id).join(',')}`,
  );
  await signOut();

  await signIn('dev-user-a@example.test');
  const { data: ownerRows, error: ownerErr } = await client
    .from('hossii_connections')
    .select('id')
    .eq('space_id', SPACE_PUBLIC)
    .eq('pane_id', PANE_PUBLIC);
  record(
    'owner reads connection with own owner_only endpoint',
    !ownerErr && (ownerRows ?? []).some((row) => row.id === ownerOnlyConnectionId),
    ownerErr?.message ?? `count=${ownerRows?.length ?? 0}`,
  );
  await signOut();

  const hiddenId = `rls-hidden-${Date.now()}`;
  await admin.from('hossiis').insert({
    id: hiddenId,
    message: 'hidden endpoint',
    space_id: SPACE_PUBLIC,
    space_pane_id: PANE_PUBLIC,
    author_name: 'Admin',
    origin: 'manual',
    is_hidden: true,
    created_at: new Date().toISOString(),
  });
  tempHossiiIds.push(hiddenId);
  await signIn('dev-community-admin@example.test');
  const { error: hiddenInsertErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_PUBLIC,
    pane_id: PANE_PUBLIC,
    source_hossii_id: HOSSII_PUBLIC_A,
    target_hossii_id: hiddenId,
    strength: 'soft',
  });
  record(
    'hidden endpoint INSERT rejected',
    !!hiddenInsertErr && hiddenInsertErr.message.includes('not available for connection'),
    hiddenInsertErr?.message ?? 'unexpected success',
  );
  await signOut();

  const deletedId = `rls-deleted-${Date.now()}`;
  await signIn('dev-user-a@example.test');
  const { error: deletedSeedErr } = await client.from('hossiis').insert({
    id: deletedId,
    message: 'deleted endpoint',
    space_id: SPACE_PUBLIC,
    space_pane_id: PANE_PUBLIC,
    author_name: 'Dev User A',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  if (deletedSeedErr) throw new Error(`deleted seed: ${deletedSeedErr.message}`);
  tempHossiiIds.push(deletedId);
  const { error: softDelErr } = await client.rpc('soft_delete_my_hossii', { p_hossii_id: deletedId });
  if (softDelErr) throw new Error(`soft delete: ${softDelErr.message}`);
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: deletedInsertErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_PUBLIC,
    pane_id: PANE_PUBLIC,
    source_hossii_id: HOSSII_PUBLIC_A,
    target_hossii_id: deletedId,
    strength: 'soft',
  });
  record(
    'deleted endpoint INSERT rejected',
    !!deletedInsertErr && deletedInsertErr.message.includes('not available for connection'),
    deletedInsertErr?.message ?? 'unexpected success',
  );
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: crossSpaceUpdateErr } = await client
    .from('hossii_connections')
    .update({ target_hossii_id: HOSSII_OTHER_SPACE })
    .eq('id', publicConnectionId);
  record(
    'UPDATE cross-space endpoint rejected',
    !!crossSpaceUpdateErr && crossSpaceUpdateErr.message.includes('connection space_id'),
    crossSpaceUpdateErr?.message ?? 'unexpected success',
  );

  const extraPaneHossiiId = `rls-extra-pane-${Date.now()}`;
  await admin.from('hossiis').insert({
    id: extraPaneHossiiId,
    message: 'extra pane endpoint',
    space_id: SPACE_PUBLIC,
    space_pane_id: extraPaneId,
    author_name: 'Admin',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  tempHossiiIds.push(extraPaneHossiiId);
  const { error: crossPaneUpdateErr } = await client
    .from('hossii_connections')
    .update({ target_hossii_id: extraPaneHossiiId })
    .eq('id', publicConnectionId);
  record(
    'UPDATE cross-pane endpoint rejected',
    !!crossPaneUpdateErr && crossPaneUpdateErr.message.includes('connection pane_id'),
    crossPaneUpdateErr?.message ?? 'unexpected success',
  );
  await signOut();

  const { data: adminUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const communityAdminId = adminUser.users.find((u) => u.email === 'dev-community-admin@example.test')?.id;
  const userBId = adminUser.users.find((u) => u.email === 'dev-user-b@example.test')?.id;
  if (!communityAdminId || !userBId) throw new Error('missing dev user ids');

  await signIn('dev-community-admin@example.test');
  const createdByProbeTarget = `rls-created-by-${Date.now()}`;
  await client.from('hossiis').insert({
    id: createdByProbeTarget,
    message: 'created_by probe',
    space_id: SPACE_PUBLIC,
    space_pane_id: PANE_PUBLIC,
    author_name: 'Community Admin',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  tempHossiiIds.push(createdByProbeTarget);
  const { data: createdByProbe, error: createdByProbeErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_PUBLIC,
      pane_id: PANE_PUBLIC,
      source_hossii_id: 'dev-post-009',
      target_hossii_id: createdByProbeTarget,
      strength: 'medium',
    })
    .select('id, created_by')
    .single();
  if (createdByProbeErr) throw new Error(`created_by probe insert: ${createdByProbeErr.message}`);
  createdConnectionIds.push(createdByProbe.id);

  const { data: beforeCreatedBy } = await client
    .from('hossii_connections')
    .select('created_by')
    .eq('id', createdByProbe.id)
    .single();
  const { error: createdByUpdateErr } = await client
    .from('hossii_connections')
    .update({ created_by: userBId })
    .eq('id', createdByProbe.id);
  const { data: afterCreatedBy } = await client
    .from('hossii_connections')
    .select('created_by')
    .eq('id', createdByProbe.id)
    .single();
  record(
    'UPDATE cannot rewrite created_by',
    !createdByUpdateErr &&
      beforeCreatedBy?.created_by === communityAdminId &&
      afterCreatedBy?.created_by === communityAdminId &&
      createdByProbe.created_by === communityAdminId,
    `before=${beforeCreatedBy?.created_by} after=${afterCreatedBy?.created_by}`,
  );
  await signOut();

  archivedProbeConnectionId = (
    await seedConnection({
      space_id: SPACE_PUBLIC,
      pane_id: PANE_PUBLIC,
      source_hossii_id: HOSSII_PUBLIC_A,
      target_hossii_id: HOSSII_PUBLIC_ADMIN,
      strength: 'soft',
    })
  ).id;

  await signIn('dev-community-admin@example.test');
  await client.rpc('set_space_archived', { p_space_id: SPACE_PUBLIC, p_archived: true });

  const { data: archivedReadRows, error: archivedReadErr } = await client
    .from('hossii_connections')
    .select('id')
    .eq('space_id', SPACE_PUBLIC)
    .eq('pane_id', PANE_PUBLIC);
  record(
    'archived space SELECT still allowed',
    !archivedReadErr && (archivedReadRows ?? []).length >= 1,
    archivedReadErr?.message ?? `count=${archivedReadRows?.length ?? 0}`,
  );

  const archivedInsertPairId = `rls-archived-ins-${Date.now()}`;
  await admin.from('hossiis').insert({
    id: archivedInsertPairId,
    message: 'archived insert probe',
    space_id: SPACE_PUBLIC,
    space_pane_id: PANE_PUBLIC,
    author_name: 'Admin',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  tempHossiiIds.push(archivedInsertPairId);
  const { error: archivedInsertErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_PUBLIC,
    pane_id: PANE_PUBLIC,
    source_hossii_id: HOSSII_PUBLIC_B,
    target_hossii_id: archivedInsertPairId,
    strength: 'strong',
  });
  record(
    'archived space INSERT blocked',
    !!archivedInsertErr && archivedInsertErr.message.includes(BLOCKED),
    archivedInsertErr?.message ?? '',
  );

  const { error: archivedUpdateErr } = await client
    .from('hossii_connections')
    .update({ strength: 'strong' })
    .eq('id', archivedProbeConnectionId);
  record(
    'archived space UPDATE blocked',
    !!archivedUpdateErr && archivedUpdateErr.message.includes(BLOCKED),
    archivedUpdateErr?.message ?? '',
  );

  const { error: archivedDeleteErr } = await client
    .from('hossii_connections')
    .delete()
    .eq('id', archivedProbeConnectionId);
  record(
    'archived space DELETE blocked',
    !!archivedDeleteErr && archivedDeleteErr.message.includes(BLOCKED),
    archivedDeleteErr?.message ?? '',
  );

  await client.rpc('set_space_archived', { p_space_id: SPACE_PUBLIC, p_archived: false });
  await signOut();

  await cleanupConnections();
  await cleanupTempHossiis();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} hossii_connections RLS coverage checks passed.`);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await admin.from('spaces').update({ access_mode: 'public' }).eq('id', SPACE_INVITE);
    await admin.from('spaces').update({ access_mode: 'public' }).eq('id', SPACE_PRIVATE);
    await admin.rpc('set_space_archived', { p_space_id: SPACE_PUBLIC, p_archived: false });
    await cleanupConnections();
    await cleanupTempHossiis();
  } catch {
    // ignore cleanup errors on crash
  }
  process.exit(1);
});
