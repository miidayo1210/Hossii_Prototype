#!/usr/bin/env node
/**
 * Development Supabase checks for update_like_count SECURITY DEFINER fix.
 * Requires: migration applied, .env.local + dev credential files.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;
const TEST_HOSSII_ID = '1784650809077-wk33o5n';
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

async function signIn(email) {
  const { error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
}

async function signOut() {
  await client.auth.signOut();
}

async function readLikeCount() {
  const { data, error } = await admin
    .from('hossiis')
    .select('like_count')
    .eq('id', TEST_HOSSII_ID)
    .single();
  if (error) throw error;
  return data.like_count;
}

async function cleanupLike(userId) {
  await admin.from('hossii_likes').delete().eq('hossii_id', TEST_HOSSII_ID).eq('user_id', userId);
}

async function main() {
  const { count: hossiiCountBefore } = await admin
    .from('hossiis')
    .select('*', { count: 'exact', head: true });
  const { count: membershipCountBefore } = await admin
    .from('space_memberships')
    .select('*', { count: 'exact', head: true });

  await signIn('dev-community-admin@example.test');
  const { data: { user } } = await client.auth.getUser();
  const adminUid = user.id;

  await cleanupLike(adminUid);
  const baseline = await readLikeCount();

  const { error: insertErr } = await client.from('hossii_likes').insert({
    hossii_id: TEST_HOSSII_ID,
    user_id: adminUid,
  });
  record('authenticated INSERT hossii_likes', !insertErr, insertErr?.message ?? '');
  const afterInsert = await readLikeCount();
  record('like_count increases on INSERT', afterInsert === baseline + 1, `${baseline} -> ${afterInsert}`);

  const { error: deleteErr } = await client
    .from('hossii_likes')
    .delete()
    .eq('hossii_id', TEST_HOSSII_ID)
    .eq('user_id', adminUid);
  record('authenticated DELETE own like', !deleteErr, deleteErr?.message ?? '');
  const afterDelete = await readLikeCount();
  record('like_count decreases on DELETE', afterDelete === baseline, `${afterInsert} -> ${afterDelete}`);

  await signOut();
  await signIn('dev-community-admin@example.test');
  const { data: reloadRow, error: reloadErr } = await client
    .from('hossiis')
    .select('like_count')
    .eq('id', TEST_HOSSII_ID)
    .single();
  record('reload like_count matches baseline', !reloadErr && reloadRow.like_count === baseline, String(reloadRow?.like_count));

  const otherUid = '00000000-0000-4000-8000-000000000001';
  const { error: foreignInsertErr } = await client.from('hossii_likes').insert({
    hossii_id: TEST_HOSSII_ID,
    user_id: otherUid,
  });
  record(
    'cannot INSERT with another user_id',
    !!foreignInsertErr,
    foreignInsertErr?.message ?? 'unexpected success',
  );

  await client.from('hossii_likes').insert({ hossii_id: TEST_HOSSII_ID, user_id: adminUid });
  const countBeforeForeignDelete = await readLikeCount();
  await signOut();
  await signIn('dev-user-a@example.test');
  const { error: foreignDeleteErr } = await client
    .from('hossii_likes')
    .delete()
    .eq('hossii_id', TEST_HOSSII_ID)
    .eq('user_id', adminUid);
  const { data: stillLiked } = await admin
    .from('hossii_likes')
    .select('hossii_id')
    .eq('hossii_id', TEST_HOSSII_ID)
    .eq('user_id', adminUid)
    .maybeSingle();
  const countAfterForeignDelete = await readLikeCount();
  record(
    'cannot DELETE another user like (RLS)',
    !foreignDeleteErr && stillLiked != null && countAfterForeignDelete === countBeforeForeignDelete,
    foreignDeleteErr?.message ?? 'row preserved',
  );
  await signOut();

  await signIn('dev-community-admin@example.test');
  const { error: dupErr } = await client.from('hossii_likes').insert({
    hossii_id: TEST_HOSSII_ID,
    user_id: adminUid,
  });
  record(
    'duplicate INSERT rejected',
    !!dupErr && (dupErr.code === '23505' || dupErr.message.includes('duplicate')),
    dupErr?.message ?? 'unexpected success',
  );
  await cleanupLike(adminUid);
  await signOut();

  const guest = createClient(DEV_URL, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const beforeGuest = await readLikeCount();
  const { data: guestCount, error: guestErr } = await guest.rpc('increment_hossii_like', {
    p_hossii_id: TEST_HOSSII_ID,
  });
  const afterGuest = await readLikeCount();
  record(
    'guest increment_hossii_like RPC',
    !guestErr && guestCount === afterGuest && afterGuest === beforeGuest + 1,
    guestErr?.message ?? `${beforeGuest} -> ${afterGuest}`,
  );

  const { data: archivedSpace } = await admin
    .from('spaces')
    .select('id,is_archived')
    .eq('id', SPACE_ID)
    .single();
  record('test space not archived', archivedSpace?.is_archived === false);

  const { count: hossiiCountAfter } = await admin
    .from('hossiis')
    .select('*', { count: 'exact', head: true });
  const { count: membershipCountAfter } = await admin
    .from('space_memberships')
    .select('*', { count: 'exact', head: true });
  record('hossiis row count unchanged', hossiiCountAfter === hossiiCountBefore, `${hossiiCountBefore}`);
  record(
    'space_memberships row count unchanged',
    membershipCountAfter === membershipCountBefore,
    `${membershipCountBefore}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- summary ---');
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
