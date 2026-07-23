#!/usr/bin/env node
/**
 * Development Supabase integration checks for Type B TB-2 (atomic create RPC).
 * Requires: migration applied on dev, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const SPACE_ID = 'dev-space-public';
const OTHER_SPACE_ID = 'dev-space-private';
const PANE_ID = `${SPACE_ID}-pane-default`;
const OTHER_PANE_ID = `${OTHER_SPACE_ID}-pane-default`;
const ORIGIN_ID = 'dev-post-001';
const ARCHIVED_MSG = 'このスペースはアーカイブされているため変更できません';

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
const createdHossiiIds = [];
const createdConnectionIds = [];
const createdIdempotencyKeys = [];

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

function basePayload(overrides = {}) {
  const ts = Date.now();
  return {
    p_idempotency_key: randomUUID(),
    p_space_id: SPACE_ID,
    p_pane_id: PANE_ID,
    p_origin_hossii_id: ORIGIN_ID,
    p_new_hossii_id: `tb2-${ts}-${Math.random().toString(36).slice(2, 8)}`,
    p_message: 'Type B integration test',
    p_position_x: 40,
    p_position_y: 55,
    p_emotion: 'joy',
    p_author_id: null,
    p_author_name: 'TB2 Test',
    ...overrides,
  };
}

async function callTypeB(payload) {
  return client.rpc('create_type_b_connected_hossii', payload);
}

async function ensureUnarchived() {
  await signIn('dev-community-admin@example.test');
  const { error } = await client.rpc('set_space_archived', {
    p_space_id: SPACE_ID,
    p_archived: false,
  });
  await signOut();
  if (error) throw new Error(`ensureUnarchived: ${error.message}`);
}

async function setupActiveMember(userId) {
  const { data: space, error: spaceErr } = await admin
    .from('spaces')
    .select('community_id')
    .eq('id', SPACE_ID)
    .single();
  if (spaceErr) throw spaceErr;

  const { error } = await admin.from('space_memberships').upsert(
    {
      space_id: SPACE_ID,
      auth_user_id: userId,
      role: 'member',
      status: 'active',
    },
    { onConflict: 'space_id,auth_user_id' },
  );
  if (error) throw new Error(`setupActiveMember: ${error.message}`);

  await admin.from('community_memberships').upsert(
    {
      community_id: space.community_id,
      auth_user_id: userId,
      role: 'member',
      status: 'active',
    },
    { onConflict: 'community_id,auth_user_id' },
  );
}

async function removeMembership(userId) {
  await admin.from('space_memberships').delete().eq('space_id', SPACE_ID).eq('auth_user_id', userId);
}

async function cleanup() {
  if (createdConnectionIds.length > 0) {
    await admin.from('hossii_connections').delete().in('id', createdConnectionIds);
  }
  if (createdHossiiIds.length > 0) {
    await admin
      .from('hossii_connections')
      .delete()
      .or(createdHossiiIds.map((id) => `source_hossii_id.eq.${id},target_hossii_id.eq.${id}`).join(','));
    await admin.from('hossiis').delete().in('id', createdHossiiIds);
  }
  if (createdIdempotencyKeys.length > 0) {
    for (const key of createdIdempotencyKeys) {
      await admin.from('type_b_create_idempotency').delete().eq('idempotency_key', key);
    }
  }
  await admin.from('hossiis').delete().eq('id', 'dev-tb2-rollback-probe');
}

async function trackSuccess(payload, data) {
  if (data?.new_hossii_id) createdHossiiIds.push(data.new_hossii_id);
  if (data?.connection_id) createdConnectionIds.push(data.connection_id);
  if (payload.p_idempotency_key) createdIdempotencyKeys.push(payload.p_idempotency_key);
}

async function getDevUserIds() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const find = (email) => data.users.find((u) => u.email === email)?.id;
  return {
    userA: find('dev-user-a@example.test'),
    userB: find('dev-user-b@example.test'),
    userSameName: find('dev-user-same-name@example.test'),
    communityAdmin: find('dev-community-admin@example.test'),
  };
}

async function main() {
  const { data: rpcProbe, error: rpcProbeErr } = await admin.rpc('create_type_b_connected_hossii', {
    p_idempotency_key: randomUUID(),
    p_space_id: SPACE_ID,
    p_pane_id: PANE_ID,
    p_origin_hossii_id: ORIGIN_ID,
    p_new_hossii_id: 'tb2-probe',
    p_message: 'probe',
    p_position_x: 10,
    p_position_y: 10,
  });
  record(
    'migration applied (RPC callable)',
    !rpcProbeErr || rpcProbeErr.message !== 'Could not find the function public.create_type_b_connected_hossii',
    rpcProbeErr?.message ?? 'callable',
  );
  if (rpcProbeErr?.message?.includes('Could not find the function')) {
    console.error('Apply migration to Development first: npm run db:push:dev');
    process.exit(1);
  }

  await ensureUnarchived();
  const userIds = await getDevUserIds();
  if (userIds.userA) await setupActiveMember(userIds.userA);

  try {
    // active member success
    await signIn('dev-user-a@example.test');
    const memberPayload = basePayload();
    const { data: memberData, error: memberErr } = await callTypeB(memberPayload);
    await trackSuccess(memberPayload, memberData);
    record('active member success', !memberErr && memberData?.idempotent_replay === false, memberErr?.message ?? JSON.stringify(memberData));
    await signOut();

    // admin success
    await signIn('dev-community-admin@example.test');
    const adminPayload = basePayload();
    const { data: adminData, error: adminErr } = await callTypeB(adminPayload);
    await trackSuccess(adminPayload, adminData);
    record('admin success', !adminErr && !!adminData?.connection_id, adminErr?.message ?? '');
    await signOut();

    // personal owner success
    await signIn('dev-user-a@example.test');
    const { data: spaceRow } = await admin.from('spaces').select('community_id').eq('id', SPACE_ID).single();
    await client.rpc('ensure_my_personal_space', { p_community_id: spaceRow.community_id });
    const { data: personalSpace } = await admin
      .from('spaces')
      .select('id')
      .eq('space_type', 'personal')
      .eq('owner_user_id', userIds.userA)
      .maybeSingle();
    if (personalSpace?.id) {
      const personalPane = `${personalSpace.id}-pane-default`;
      const { a, b } = await (async () => {
        const ts = Date.now();
        const aId = `tb2-personal-a-${ts}`;
        const bId = `tb2-personal-b-${ts}`;
        for (const [id, msg] of [
          [aId, 'origin'],
          [bId, 'unused'],
        ]) {
          await admin.from('hossiis').insert({
            id,
            message: msg,
            space_id: personalSpace.id,
            space_pane_id: personalPane,
            author_name: 'personal',
            origin: 'manual',
            created_at: new Date().toISOString(),
          });
          createdHossiiIds.push(id);
        }
        return { a: aId, b: bId };
      })();
      const personalPayload = basePayload({
        p_space_id: personalSpace.id,
        p_pane_id: personalPane,
        p_origin_hossii_id: a,
        p_new_hossii_id: `tb2-personal-new-${Date.now()}`,
      });
      const { data: personalData, error: personalErr } = await callTypeB(personalPayload);
      await trackSuccess(personalPayload, personalData);
      record('personal owner success', !personalErr && !!personalData?.connection_id, personalErr?.message ?? '');
    } else {
      record('personal owner success', false, 'personal space missing');
    }
    await signOut();

    // anon reject
    const anonPayload = basePayload();
    const { error: anonErr } = await callTypeB(anonPayload);
    record('anon reject', !!anonErr, anonErr?.message ?? 'unexpected success');

    // membership none reject
    if (userIds.userSameName) {
      await removeMembership(userIds.userSameName);
      await signIn('dev-user-same-name@example.test');
      const nonePayload = basePayload();
      const { error: noneErr } = await callTypeB(nonePayload);
      record('membership none reject', !!noneErr, noneErr?.message ?? '');
      await signOut();
    }

    // archived reject
    await signIn('dev-community-admin@example.test');
    await client.rpc('set_space_archived', { p_space_id: SPACE_ID, p_archived: true });
    await signIn('dev-user-a@example.test');
    const archivedPayload = basePayload();
    const { error: archivedErr } = await callTypeB(archivedPayload);
    record(
      'archived reject',
      !!archivedErr && archivedErr.message.includes(ARCHIVED_MSG),
      archivedErr?.message ?? '',
    );
    await signOut();
    await signIn('dev-community-admin@example.test');
    await client.rpc('set_space_archived', { p_space_id: SPACE_ID, p_archived: false });
    await signOut();

    // wrong space origin
    await signIn('dev-user-a@example.test');
    const wrongSpacePayload = basePayload({ p_origin_hossii_id: 'dev-post-007' });
    const { error: wrongSpaceErr } = await callTypeB(wrongSpacePayload);
    record('other space origin reject', !!wrongSpaceErr, wrongSpaceErr?.message ?? '');
    await signOut();

    // wrong pane origin (same space post without pane set uses default; use other space pane mismatch via wrong p_pane_id)
    await signIn('dev-user-a@example.test');
    const wrongPanePayload = basePayload({ p_pane_id: OTHER_PANE_ID });
    const { error: wrongPaneErr } = await callTypeB(wrongPanePayload);
    record('wrong pane reject', !!wrongPaneErr, wrongPaneErr?.message ?? '');
    await signOut();

    // hidden origin
    const hiddenOrigin = `tb2-hidden-origin-${Date.now()}`;
    await admin.from('hossiis').insert({
      id: hiddenOrigin,
      message: 'hidden origin',
      space_id: SPACE_ID,
      space_pane_id: PANE_ID,
      author_name: 'test',
      origin: 'manual',
      is_hidden: true,
      created_at: new Date().toISOString(),
    });
    createdHossiiIds.push(hiddenOrigin);
    await signIn('dev-user-a@example.test');
    const hiddenPayload = basePayload({ p_origin_hossii_id: hiddenOrigin });
    const { error: hiddenErr } = await callTypeB(hiddenPayload);
    record('hidden origin reject', !!hiddenErr, hiddenErr?.message ?? '');
    await signOut();

    // deleted origin
    const deletedOrigin = `tb2-deleted-origin-${Date.now()}`;
    await admin.from('hossiis').insert({
      id: deletedOrigin,
      message: 'deleted origin',
      space_id: SPACE_ID,
      space_pane_id: PANE_ID,
      author_name: 'test',
      origin: 'manual',
      deleted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    createdHossiiIds.push(deletedOrigin);
    await signIn('dev-user-a@example.test');
    const deletedPayload = basePayload({ p_origin_hossii_id: deletedOrigin });
    const { error: deletedErr } = await callTypeB(deletedPayload);
    record('deleted origin reject', !!deletedErr, deletedErr?.message ?? '');
    await signOut();

    // owner_only non-owner reject
    const ownerOnlyOrigin = `tb2-owner-only-${Date.now()}`;
    await admin.from('hossiis').insert({
      id: ownerOnlyOrigin,
      message: 'owner only',
      space_id: SPACE_ID,
      space_pane_id: PANE_ID,
      author_name: 'admin',
      origin: 'manual',
      visibility: 'owner_only',
      created_at: new Date().toISOString(),
    });
    if (userIds.communityAdmin) {
      await admin.from('hossii_authorships').upsert({
        hossii_id: ownerOnlyOrigin,
        auth_user_id: userIds.communityAdmin,
      });
    }
    createdHossiiIds.push(ownerOnlyOrigin);
    await signIn('dev-user-a@example.test');
    const ownerOnlyPayload = basePayload({ p_origin_hossii_id: ownerOnlyOrigin });
    const { error: ownerOnlyErr } = await callTypeB(ownerOnlyPayload);
    record('owner_only non-owner reject', !!ownerOnlyErr, ownerOnlyErr?.message ?? '');
    await signOut();

    // invalid position
    await signIn('dev-user-a@example.test');
    const badPosPayload = basePayload({ p_position_x: 150, p_new_hossii_id: `tb2-badpos-${Date.now()}` });
    const { error: badPosErr } = await callTypeB(badPosPayload);
    const { data: badPosRow } = await admin.from('hossiis').select('id').eq('id', badPosPayload.p_new_hossii_id).maybeSingle();
    record('invalid position reject', !!badPosErr && !badPosRow, badPosErr?.message ?? '');
    await signOut();

    // empty message
    await signIn('dev-user-a@example.test');
    const emptyMsgId = `tb2-empty-${Date.now()}`;
    const emptyPayload = basePayload({ p_message: '   ', p_new_hossii_id: emptyMsgId });
    const { error: emptyErr } = await callTypeB(emptyPayload);
    const { data: emptyRow } = await admin.from('hossiis').select('id').eq('id', emptyMsgId).maybeSingle();
    record('empty message reject', !!emptyErr && !emptyRow, emptyErr?.message ?? '');
    await signOut();

    // message too long (>200)
    await signIn('dev-user-a@example.test');
    const longMsgId = `tb2-long-${Date.now()}`;
    const longPayload = basePayload({ p_message: 'x'.repeat(201), p_new_hossii_id: longMsgId });
    const { error: longErr } = await callTypeB(longPayload);
    const { data: longRow } = await admin.from('hossiis').select('id').eq('id', longMsgId).maybeSingle();
    record('message max length reject', !!longErr && !longRow, longErr?.message ?? '');
    await signOut();

    // connection failure rollback (dev probe RPC)
    const { error: rollbackErr } = await admin.rpc('dev_test_type_b_transaction_rollback');
    const { data: probeRow } = await admin.from('hossiis').select('id').eq('id', 'dev-tb2-rollback-probe').maybeSingle();
    record('connection failure rolls back post', !!rollbackErr && !probeRow, rollbackErr?.message ?? 'probe remained');

    // idempotent replay
    await signIn('dev-user-a@example.test');
    const replayKey = randomUUID();
    const replayPayload = basePayload({ p_idempotency_key: replayKey, p_new_hossii_id: `tb2-replay-${Date.now()}` });
    const first = await callTypeB(replayPayload);
    const second = await callTypeB(replayPayload);
    await trackSuccess(replayPayload, first.data);
    record(
      'same key same payload replay',
      !first.error && !second.error && second.data?.idempotent_replay === true,
      second.error?.message ?? JSON.stringify(second.data),
    );

    // same key different payload reject
    const conflictKey = randomUUID();
    const conflictA = basePayload({ p_idempotency_key: conflictKey, p_new_hossii_id: `tb2-conflict-a-${Date.now()}` });
    const conflictB = {
      ...conflictA,
      p_message: 'different payload',
      p_new_hossii_id: `tb2-conflict-b-${Date.now()}`,
    };
    const conflictFirst = await callTypeB(conflictA);
    const conflictSecond = await callTypeB(conflictB);
    await trackSuccess(conflictA, conflictFirst.data);
    createdIdempotencyKeys.push(conflictKey);
    record(
      'same key different payload reject',
      !conflictFirst.error && !!conflictSecond.error,
      conflictSecond.error?.message ?? '',
    );
    await signOut();

    // origin immutability + Type A NULL regression
    await signIn('dev-user-a@example.test');
    const typeAOrigin = `tb2-typea-a-${Date.now()}`;
    const typeBOrigin = `tb2-typea-b-${Date.now()}`;
    for (const [id, msg] of [
      [typeAOrigin, 'type a'],
      [typeBOrigin, 'type b target'],
    ]) {
      await admin.from('hossiis').insert({
        id,
        message: msg,
        space_id: SPACE_ID,
        space_pane_id: PANE_ID,
        author_name: 'test',
        origin: 'manual',
        created_at: new Date().toISOString(),
      });
      createdHossiiIds.push(id);
    }
    const { data: typeAConn, error: typeAErr } = await client
      .from('hossii_connections')
      .insert({
        space_id: SPACE_ID,
        pane_id: PANE_ID,
        source_hossii_id: typeAOrigin,
        target_hossii_id: typeBOrigin,
        strength: 'soft',
      })
      .select('*')
      .single();
    if (typeAConn?.id) createdConnectionIds.push(typeAConn.id);
    record('Type A NULL origin regression', !typeAErr && typeAConn?.origin_hossii_id == null, typeAErr?.message ?? '');

    if (typeAConn?.id) {
      const { data: updated, error: updateErr } = await client
        .from('hossii_connections')
        .update({ origin_hossii_id: ORIGIN_ID })
        .eq('id', typeAConn.id)
        .select('origin_hossii_id')
        .single();
      record(
        'origin_hossii_id immutable on UPDATE',
        !updateErr && updated?.origin_hossii_id == null,
        updateErr?.message ?? String(updated?.origin_hossii_id),
      );
    }
    await signOut();

    // strength medium / reason null on successful create
    if (memberData?.connection_id) {
      const { data: connRow } = await admin
        .from('hossii_connections')
        .select('strength, reason_text, reason_emoji, origin_hossii_id')
        .eq('id', memberData.connection_id)
        .single();
      record(
        'strength medium and reason NULL',
        connRow?.strength === 'medium' &&
          connRow.reason_text == null &&
          connRow.reason_emoji == null &&
          connRow.origin_hossii_id === ORIGIN_ID,
        JSON.stringify(connRow),
      );
    } else {
      record('strength medium and reason NULL', false, 'missing member connection');
    }

    // authorship created
    if (memberData?.new_hossii_id && userIds.userA) {
      const { data: authorship } = await admin
        .from('hossii_authorships')
        .select('auth_user_id')
        .eq('hossii_id', memberData.new_hossii_id)
        .maybeSingle();
      record('authorship created', authorship?.auth_user_id === userIds.userA, JSON.stringify(authorship));
    } else {
      record('authorship created', false, 'missing hossii');
    }
  } finally {
    await cleanup();
    if (userIds.userA) await setupActiveMember(userIds.userA);
    await ensureUnarchived();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- summary ---');
  console.log(`passed ${results.length - failed.length}/${results.length}`);
  if (failed.length > 0) {
    console.error('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
