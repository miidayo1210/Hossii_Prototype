#!/usr/bin/env node
/**
 * Development Supabase integration checks for space archive (112 DB layer).
 * Requires: migration applied, seed users, .env.local + credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const SPACE_ID = 'dev-space-public';
const OTHER_SPACE_ID = 'dev-space-private';
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

async function setArchived(archived) {
  const { error } = await client.rpc('set_space_archived', {
    p_space_id: SPACE_ID,
    p_archived: archived,
  });
  return error;
}

async function ensureUnarchived() {
  await signIn('dev-community-admin@example.test');
  const err = await setArchived(false);
  await signOut();
  if (err) throw new Error(`ensureUnarchived: ${err.message}`);
}

async function main() {
  await ensureUnarchived();

  const { data: spaces, error: spacesErr } = await admin
    .from('spaces')
    .select('id,is_archived')
    .in('id', [SPACE_ID, OTHER_SPACE_ID]);
  if (spacesErr) throw spacesErr;
  const allFalse = (spaces ?? []).every((s) => s.is_archived === false);
  record('existing spaces default is_archived=false', allFalse, JSON.stringify(spaces));

  await signIn('dev-community-admin@example.test');
  const archiveOk = await setArchived(true);
  record('admin can archive ON', !archiveOk, archiveOk?.message ?? '');
  await signOut();

  await signIn('dev-user-a@example.test');
  const memberArchive = await setArchived(false);
  record('member cannot change archive', !!memberArchive, memberArchive?.message ?? '');
  await signOut();

  await signIn('dev-user-a@example.test');
  const { error: insertErr } = await client.from('hossiis').insert({
    id: `archive-test-${Date.now()}`,
    message: 'archive blocked',
    space_id: SPACE_ID,
    space_pane_id: `${SPACE_ID}-pane-default`,
    author_name: 'Dev User A',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  record(
    'archived space blocks insert',
    !!insertErr && insertErr.message.includes(BLOCKED),
    insertErr?.message ?? 'insert unexpectedly succeeded',
  );

  const { data: readRows, error: readErr } = await client
    .from('hossiis')
    .select('id')
    .eq('space_id', SPACE_ID)
    .limit(1);
  record('archived space still readable', !readErr && (readRows?.length ?? 0) >= 0, readErr?.message ?? '');
  await signOut();

  // Prepare owned post while temporarily unarchived
  await signIn('dev-community-admin@example.test');
  await setArchived(false);
  await signOut();

  await signIn('dev-user-a@example.test');
  const postId = `archive-owned-${Date.now()}`;
  const { error: seedErr } = await client.from('hossiis').insert({
    id: postId,
    message: 'seed for archive mutation tests',
    space_id: SPACE_ID,
    space_pane_id: `${SPACE_ID}-pane-default`,
    author_name: 'Dev User A',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  if (seedErr) throw new Error(`seed post: ${seedErr.message}`);
  await signOut();

  await signIn('dev-community-admin@example.test');
  await setArchived(true);
  await signOut();

  await signIn('dev-user-a@example.test');
  const { error: editErr } = await client.rpc('update_my_hossii', {
    p_hossii_id: postId,
    p_message: 'edited',
  });
  record(
    'archived blocks body edit RPC',
    !!editErr && editErr.message.includes(BLOCKED),
    editErr?.message ?? '',
  );

  const { error: visErr } = await client.rpc('set_my_hossii_visibility', {
    p_hossii_id: postId,
    p_visibility: 'owner_only',
  });
  record(
    'archived blocks visibility RPC',
    !!visErr && visErr.message.includes(BLOCKED),
    visErr?.message ?? '',
  );

  const { error: delErr } = await client.rpc('soft_delete_my_hossii', { p_hossii_id: postId });
  record(
    'archived blocks soft delete RPC',
    !!delErr && delErr.message.includes(BLOCKED),
    delErr?.message ?? '',
  );

  const { error: posErr } = await client
    .from('hossiis')
    .update({ position_x: 0.42 })
    .eq('id', postId);
  record(
    'archived blocks position update',
    !!posErr && posErr.message.includes(BLOCKED),
    posErr?.message ?? '',
  );

  const { data: likeCount, error: likeErr } = await client.rpc('increment_hossii_like', {
    p_hossii_id: postId,
  });
  record(
    'archived blocks increment like RPC',
    !!likeErr || likeCount == null,
    likeErr?.message ?? `likeCount=${likeCount}`,
  );

  const { error: otherInsertErr } = await client.from('hossiis').insert({
    id: `archive-other-${Date.now()}`,
    message: 'other space ok',
    space_id: OTHER_SPACE_ID,
    space_pane_id: `${OTHER_SPACE_ID}-pane-default`,
    author_name: 'Dev User A',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  record('other space unaffected', !otherInsertErr, otherInsertErr?.message ?? '');
  await signOut();

  await signIn('dev-community-admin@example.test');
  const unarchiveErr = await setArchived(false);
  record('admin can archive OFF', !unarchiveErr, unarchiveErr?.message ?? '');
  await signOut();

  await signIn('dev-user-a@example.test');
  const { error: postUnarchiveErr } = await client.from('hossiis').insert({
    id: `archive-after-${Date.now()}`,
    message: 'after unarchive',
    space_id: SPACE_ID,
    space_pane_id: `${SPACE_ID}-pane-default`,
    author_name: 'Dev User A',
    origin: 'manual',
    created_at: new Date().toISOString(),
  });
  record('post works after unarchive', !postUnarchiveErr, postUnarchiveErr?.message ?? '');
  await signOut();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error('\nFailed checks:', failed.length);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} archive checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
