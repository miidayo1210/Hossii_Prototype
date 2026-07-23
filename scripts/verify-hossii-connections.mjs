#!/usr/bin/env node
/**
 * Development Supabase integration checks for hossii_connections (126 Phase 1).
 * Requires: migration applied on dev, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const SPACE_ID = 'dev-space-public';
const OTHER_SPACE_ID = 'dev-space-private';
const PANE_ID = `${SPACE_ID}-pane-default`;
const OTHER_PANE_ID = `${OTHER_SPACE_ID}-pane-default`;
const HOSSII_A = 'dev-post-001';
const HOSSII_B = 'dev-post-002';
const HOSSII_OTHER_SPACE = 'dev-post-004';
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

const REASON_EMOJI_PRESETS = ['💡', '🔗', '🌱', '💬', '↔️', '🎯', '❤️', '❓'];

const results = [];
const createdConnectionIds = [];
const tempHossiiIds = [];
let extraPaneId = null;

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

async function ensureUnarchived() {
  await signIn('dev-community-admin@example.test');
  const { error } = await client.rpc('set_space_archived', {
    p_space_id: SPACE_ID,
    p_archived: false,
  });
  await signOut();
  if (error) throw new Error(`ensureUnarchived: ${error.message}`);
}

async function cleanupConnections() {
  if (createdConnectionIds.length === 0) return;
  await admin.from('hossii_connections').delete().in('id', createdConnectionIds);
  createdConnectionIds.length = 0;
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

async function createTempHossiiPair(prefix) {
  const ts = Date.now();
  const a = `${prefix}-a-${ts}`;
  const b = `${prefix}-b-${ts}`;
  for (const [id, label] of [
    [a, 'Reason A'],
    [b, 'Reason B'],
  ]) {
    const { error } = await admin.from('hossiis').insert({
      id,
      message: label,
      space_id: SPACE_ID,
      space_pane_id: PANE_ID,
      author_name: 'ReasonTest',
      origin: 'manual',
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(`createTempHossiiPair ${id}: ${error.message}`);
    tempHossiiIds.push(id);
  }
  return { a, b };
}

async function runReasonColumnChecks() {
  await signIn('dev-community-admin@example.test');

  const { a: pairA, b: pairB } = await createTempHossiiPair('reason-null');
  const { data: nullReasonConn, error: nullReasonErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: pairA,
      target_hossii_id: pairB,
      strength: 'medium',
      reason_text: null,
      reason_emoji: null,
    })
    .select('id, reason_text, reason_emoji')
    .single();
  record(
    'reason: both NULL create',
    !nullReasonErr &&
      nullReasonConn?.reason_text == null &&
      nullReasonConn?.reason_emoji == null,
    nullReasonErr?.message ?? JSON.stringify(nullReasonConn),
  );
  if (nullReasonConn?.id) createdConnectionIds.push(nullReasonConn.id);

  const { a: text50A, b: text50B } = await createTempHossiiPair('reason-50');
  const text50 = 'あ'.repeat(50);
  const { data: text50Conn, error: text50Err } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: text50A,
      target_hossii_id: text50B,
      strength: 'soft',
      reason_text: text50,
    })
    .select('id, reason_text')
    .single();
  record(
    'reason: reason_text 50 chars allowed',
    !text50Err && text50Conn?.reason_text === text50,
    text50Err?.message ?? text50Conn?.reason_text?.length,
  );
  if (text50Conn?.id) createdConnectionIds.push(text50Conn.id);

  const { a: text51A, b: text51B } = await createTempHossiiPair('reason-51');
  const { error: text51Err } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: text51A,
    target_hossii_id: text51B,
    strength: 'soft',
    reason_text: 'a'.repeat(51),
  });
  record(
    'reason: reason_text 51 chars rejected',
    !!text51Err,
    text51Err?.message ?? 'unexpected success',
  );

  const { a: nlA, b: nlB } = await createTempHossiiPair('reason-nl');
  const { error: newlineErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: nlA,
    target_hossii_id: nlB,
    strength: 'soft',
    reason_text: 'line1\nline2',
  });
  record(
    'reason: reason_text newline rejected',
    !!newlineErr,
    newlineErr?.message ?? 'unexpected success',
  );

  const { a: blankA, b: blankB } = await createTempHossiiPair('reason-blank');
  const { data: blankConn, error: blankErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: blankA,
      target_hossii_id: blankB,
      strength: 'soft',
      reason_text: '   ',
    })
    .select('id, reason_text')
    .single();
  record(
    'reason: blank reason_text stored as NULL',
    !blankErr && blankConn?.reason_text == null,
    blankErr?.message ?? JSON.stringify(blankConn),
  );
  if (blankConn?.id) createdConnectionIds.push(blankConn.id);

  const { a: emptyA, b: emptyB } = await createTempHossiiPair('reason-empty');
  const { data: emptyConn, error: emptyErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: emptyA,
      target_hossii_id: emptyB,
      strength: 'soft',
      reason_text: '',
    })
    .select('id, reason_text')
    .single();
  record(
    'reason: empty string reason_text stored as NULL',
    !emptyErr && emptyConn?.reason_text == null,
    emptyErr?.message ?? JSON.stringify(emptyConn),
  );
  if (emptyConn?.id) createdConnectionIds.push(emptyConn.id);

  for (const emoji of REASON_EMOJI_PRESETS) {
    const { a, b } = await createTempHossiiPair(`reason-emoji-${emoji.codePointAt(0)}`);
    const { data: emojiConn, error: emojiErr } = await client
      .from('hossii_connections')
      .insert({
        space_id: SPACE_ID,
        pane_id: PANE_ID,
        source_hossii_id: a,
        target_hossii_id: b,
        strength: 'soft',
        reason_emoji: emoji,
      })
      .select('id, reason_emoji')
      .single();
    record(
      `reason: preset emoji ${emoji} allowed`,
      !emojiErr && emojiConn?.reason_emoji === emoji,
      emojiErr?.message ?? emojiConn?.reason_emoji ?? '',
    );
    if (emojiConn?.id) createdConnectionIds.push(emojiConn.id);
  }

  const { a: badEmojiA, b: badEmojiB } = await createTempHossiiPair('reason-bad-emoji');
  const { error: badEmojiErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: badEmojiA,
    target_hossii_id: badEmojiB,
    strength: 'soft',
    reason_emoji: '🔥',
  });
  record(
    'reason: non-preset emoji rejected',
    !!badEmojiErr,
    badEmojiErr?.message ?? 'unexpected success',
  );

  if (nullReasonConn?.id) {
    const { data: updatedWithReason, error: updateWithReasonErr } = await client
      .from('hossii_connections')
      .update({ strength: 'strong', reason_text: '更新後' })
      .eq('id', nullReasonConn.id)
      .select('strength, reason_text, created_by')
      .single();
    record(
      'reason: existing CRUD update with reason_text',
      !updateWithReasonErr &&
        updatedWithReason?.strength === 'strong' &&
        updatedWithReason?.reason_text === '更新後',
      updateWithReasonErr?.message ?? JSON.stringify(updatedWithReason),
    );
  }

  const { data: adminUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const communityAdminId = adminUser.users.find(
    (u) => u.email === 'dev-community-admin@example.test',
  )?.id;
  const userBId = adminUser.users.find((u) => u.email === 'dev-user-b@example.test')?.id;
  if (nullReasonConn?.id && communityAdminId && userBId) {
    const { error: createdByUpdateErr } = await client
      .from('hossii_connections')
      .update({ created_by: userBId, reason_text: 'still mine' })
      .eq('id', nullReasonConn.id);
    const { data: afterCreatedBy } = await client
      .from('hossii_connections')
      .select('created_by, reason_text')
      .eq('id', nullReasonConn.id)
      .single();
    record(
      'reason: created_by immutability preserved',
      !createdByUpdateErr &&
        afterCreatedBy?.created_by === communityAdminId &&
        afterCreatedBy?.reason_text === 'still mine',
      `created_by=${afterCreatedBy?.created_by}`,
    );
  }

  await signOut();
}

async function ensureHossiiPaneAssignments() {
  for (const [id, spaceId, paneId] of [
    [HOSSII_A, SPACE_ID, PANE_ID],
    [HOSSII_B, SPACE_ID, PANE_ID],
    [HOSSII_OTHER_SPACE, OTHER_SPACE_ID, OTHER_PANE_ID],
  ]) {
    const { error } = await admin
      .from('hossiis')
      .update({ space_pane_id: paneId })
      .eq('id', id)
      .eq('space_id', spaceId);
    if (error) throw new Error(`assign pane ${id}: ${error.message}`);
  }
}

async function ensureExtraPane() {
  extraPaneId = `${SPACE_ID}-pane-conn-test`;
  const { error } = await admin.from('space_panes').upsert(
    {
      id: extraPaneId,
      space_id: SPACE_ID,
      name: 'Conn Test',
      slug: 'conn-test',
      sort_order: 99,
      is_default: false,
      is_visible: true,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`ensureExtraPane: ${error.message}`);
}

async function main() {
  await ensureUnarchived();
  await ensureHossiiPaneAssignments();
  await ensureExtraPane();
  await cleanupConnections();
  await cleanupTempHossiis();

  const { count: hossiiCountBefore, error: countErr } = await admin
    .from('hossiis')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', SPACE_ID);
  if (countErr) throw countErr;

  await signIn('dev-community-admin@example.test');
  const { data: created, error: createErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: HOSSII_B,
      target_hossii_id: HOSSII_A,
      strength: 'medium',
    })
    .select('*')
    .single();
  record('admin create connection', !createErr && !!created?.id, createErr?.message ?? created?.id ?? '');
  if (created?.id) createdConnectionIds.push(created.id);
  record(
    'create normalizes A-B order',
    created?.source_hossii_id === HOSSII_A && created?.target_hossii_id === HOSSII_B,
    JSON.stringify({ source: created?.source_hossii_id, target: created?.target_hossii_id }),
  );
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: dupErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: HOSSII_A,
    target_hossii_id: HOSSII_B,
    strength: 'soft',
  });
  record('duplicate A-B rejected', !!dupErr, dupErr?.message ?? 'unexpected success');
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: selfErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: HOSSII_A,
    target_hossii_id: HOSSII_A,
    strength: 'soft',
  });
  record('self connection rejected', !!selfErr, selfErr?.message ?? '');
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: otherSpaceErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: HOSSII_A,
    target_hossii_id: HOSSII_OTHER_SPACE,
    strength: 'soft',
  });
  record('different space rejected', !!otherSpaceErr, otherSpaceErr?.message ?? '');
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: otherPaneErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: extraPaneId,
    source_hossii_id: HOSSII_A,
    target_hossii_id: HOSSII_B,
    strength: 'soft',
  });
  record('different pane rejected', !!otherPaneErr, otherPaneErr?.message ?? '');
  await signOut();

  await signIn('dev-user-a@example.test');
  const { error: memberWriteErr } = await client.from('hossii_connections').insert({
    space_id: SPACE_ID,
    pane_id: PANE_ID,
    source_hossii_id: HOSSII_A,
    target_hossii_id: HOSSII_B,
    strength: 'soft',
  });
  record('non-admin write rejected', !!memberWriteErr, memberWriteErr?.message ?? '');
  await signOut();

  await signIn('dev-super-admin@example.test');
  const { data: superCreated, error: superCreateErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: 'dev-post-009',
      target_hossii_id: 'dev-post-010',
      strength: 'strong',
    })
    .select('id')
    .single();
  record('super_admin write success', !superCreateErr && !!superCreated?.id, superCreateErr?.message ?? '');
  if (superCreated?.id) createdConnectionIds.push(superCreated.id);
  await signOut();

  await signIn('dev-user-a@example.test');
  const { data: readRows, error: readErr } = await client
    .from('hossii_connections')
    .select('id, strength')
    .eq('space_id', SPACE_ID)
    .eq('pane_id', PANE_ID);
  record(
    'member read connections',
    !readErr && (readRows?.length ?? 0) >= 1,
    readErr?.message ?? `count=${readRows?.length ?? 0}`,
  );
  await signOut();

  if (created?.id) {
    await signIn('dev-community-admin@example.test');
    const { data: updated, error: updateErr } = await client
      .from('hossii_connections')
      .update({ strength: 'soft' })
      .eq('id', created.id)
      .select('strength')
      .single();
    record('admin update strength', !updateErr && updated?.strength === 'soft', updateErr?.message ?? '');
    await signOut();
  }

  const cascadeHossiiId = `conn-cascade-${Date.now()}`;
  await admin.from('hossiis').insert({
    id: cascadeHossiiId,
    message: 'cascade test',
    space_id: SPACE_ID,
    space_pane_id: PANE_ID,
    author_name: 'Cascade',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });

  await signIn('dev-community-admin@example.test');
  const { data: cascadeConn, error: cascadeCreateErr } = await client
    .from('hossii_connections')
    .insert({
      space_id: SPACE_ID,
      pane_id: PANE_ID,
      source_hossii_id: HOSSII_A,
      target_hossii_id: cascadeHossiiId,
      strength: 'soft',
    })
    .select('id')
    .single();
  record('cascade setup create', !cascadeCreateErr && !!cascadeConn?.id, cascadeCreateErr?.message ?? '');
  await signOut();

  await admin.from('hossiis').delete().eq('id', cascadeHossiiId);
  const { count: cascadeLeft } = await admin
    .from('hossii_connections')
    .select('id', { count: 'exact', head: true })
    .eq('id', cascadeConn?.id ?? 'missing');
  record('cascade delete on hossii removal', cascadeLeft === 0, `remaining=${cascadeLeft}`);

  await runReasonColumnChecks();

  await signIn('dev-community-admin@example.test');
  await client.rpc('set_space_archived', { p_space_id: SPACE_ID, p_archived: true });
  const { error: archivedErr } = await client
    .from('hossii_connections')
    .update({ strength: 'medium' })
    .eq('id', created?.id ?? 'missing');
  record(
    'archived write blocked',
    !!archivedErr && archivedErr.message.includes(BLOCKED),
    archivedErr?.message ?? '',
  );
  await client.rpc('set_space_archived', { p_space_id: SPACE_ID, p_archived: false });
  await signOut();

  if (created?.id) {
    await signIn('dev-community-admin@example.test');
    const { error: deleteErr } = await client.from('hossii_connections').delete().eq('id', created.id);
    record('admin delete connection', !deleteErr, deleteErr?.message ?? '');
    createdConnectionIds.splice(createdConnectionIds.indexOf(created.id), 1);
    await signOut();
  }

  const { count: hossiiCountAfter, error: countAfterErr } = await admin
    .from('hossiis')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', SPACE_ID);
  if (countAfterErr) throw countAfterErr;
  record(
    'existing hossii count unchanged',
    hossiiCountBefore === hossiiCountAfter,
    `${hossiiCountBefore} -> ${hossiiCountAfter}`,
  );

  await cleanupConnections();
  await cleanupTempHossiis();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} hossii_connections checks passed.`);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await cleanupConnections();
    await cleanupTempHossiis();
  } catch {
    // ignore cleanup errors on crash
  }
  process.exit(1);
});
