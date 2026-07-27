/**
 * Development-only: verify join_space_as_member issued-participant gate (Task 2).
 * Creates ephemeral QA accounts via Auth admin (mirrors issue path), exercises RPC
 * with authenticated sessions, then cleans up. Never targets Production.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { assertLinkedTarget } from './lib/supabase-target.mjs';

assertLinkedTarget('development');
const DEV = 'uodaubhlcvvqlgsdxcdf';
const linked = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (linked !== DEV) {
  console.error('ABORT: not development');
  process.exit(2);
}

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
const anon = env.match(/^VITE_SUPABASE_ANON_KEY=(.*)$/m)?.[1]?.trim();
const service = readFileSync('.supabase-dev-service-role.local', 'utf8').trim();
if (!url?.includes(DEV)) {
  console.error('ABORT: url');
  process.exit(3);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient(accessToken) {
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function counts(uid) {
  const { data: sm } = await admin
    .from('space_memberships')
    .select('space_id')
    .eq('auth_user_id', uid);
  const { data: cm } = await admin
    .from('community_memberships')
    .select('community_id')
    .eq('auth_user_id', uid);
  return {
    sm: (sm ?? []).map((r) => r.space_id).sort(),
    cm: (cm ?? []).map((r) => r.community_id).sort(),
  };
}

async function purge(uid) {
  await admin.from('space_nicknames').delete().eq('profile_id', uid);
  await admin.from('profiles').delete().eq('id', uid);
  await admin.from('space_memberships').delete().eq('auth_user_id', uid);
  await admin.from('community_memberships').delete().eq('auth_user_id', uid);
  await admin.from('space_participant_accounts').delete().eq('auth_user_id', uid);
  await admin.from('user_profiles').delete().eq('id', uid);
  await admin.auth.admin.deleteUser(uid);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function errIncludes(error, needle) {
  const m = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`;
  return m.includes(needle);
}

const { data: spaces } = await admin
  .from('spaces')
  .select('id, space_url, community_id, access_mode, space_type')
  .eq('space_type', 'shared')
  .not('space_url', 'is', null)
  .limit(40);
const publics = (spaces ?? []).filter(
  (s) => (s.access_mode ?? 'public') === 'public' && s.space_url,
);
const issuing = publics[0];
const other = publics.find((s) => s.id !== issuing.id);
assert(issuing && other, 'need two public spaces');

const totalsBefore = {
  spa: (await admin.from('space_participant_accounts').select('*', { count: 'exact', head: true }))
    .count,
  sm: (await admin.from('space_memberships').select('*', { count: 'exact', head: true })).count,
  cm: (await admin.from('community_memberships').select('*', { count: 'exact', head: true })).count,
  spaces: (await admin.from('spaces').select('*', { count: 'exact', head: true })).count,
};

const created = [];

async function createParticipant({ spaceId, withMeta = true, status = 'active', slot }) {
  const loginId = `qaj2-${randomBytes(4).toString('hex')}`;
  const password = `QaJ2!${randomBytes(6).toString('base64url')}`;
  const authEmail = `${spaceId}.${loginId}@participants.internal`;
  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    app_metadata: withMeta ? { participant: true } : {},
  });
  if (error || !data.user) throw error ?? new Error('createUser');
  created.push(data.user.id);
  const { data: existing } = await admin
    .from('space_participant_accounts')
    .select('slot_number')
    .eq('space_id', spaceId);
  const used = new Set((existing ?? []).map((r) => r.slot_number));
  let sn = slot ?? 1;
  while (used.has(sn) && sn <= 50) sn += 1;
  const { error: spaErr } = await admin.from('space_participant_accounts').insert({
    space_id: spaceId,
    slot_number: sn,
    login_id: loginId,
    auth_user_id: data.user.id,
    auth_email: authEmail,
    status,
  });
  if (spaErr) throw spaErr;
  const { data: sess, error: signErr } = await createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.signInWithPassword({ email: authEmail, password });
  if (signErr) throw signErr;
  return { uid: data.user.id, token: sess.session.access_token, loginId, password, authEmail };
}

const results = {};

try {
  // 1-4: normal participant issuing + idempotent + community
  const p = await createParticipant({ spaceId: issuing.id });
  let c = userClient(p.token);
  let before = await counts(p.uid);
  let { data: join1, error: e1 } = await c.rpc('join_space_as_member', {
    p_space_id: issuing.id,
    p_space_nickname: 'J2発行元',
  });
  assert(!e1, `issuing join failed: ${e1?.message}`);
  let after = await counts(p.uid);
  assert(after.sm.includes(issuing.id), 'issuing sm missing');
  assert(after.cm.includes(issuing.community_id), 'issuing cm missing');
  const { error: e1b } = await c.rpc('join_space_as_member', {
    p_space_id: issuing.id,
    p_space_nickname: 'J2発行元',
  });
  assert(!e1b, `idempotent failed: ${e1b?.message}`);
  const after2 = await counts(p.uid);
  assert(after2.sm.length === after.sm.length, 'idempotent sm grew');
  results['1_4_issuing'] = { ok: true, before, after };

  // 5-10: cross-space forbidden
  before = await counts(p.uid);
  const { data: crossData, error: crossErr } = await c.rpc('join_space_as_member', {
    p_space_id: other.id,
    p_space_nickname: 'should-not',
  });
  assert(crossErr, 'cross join should fail');
  assert(
    errIncludes(crossErr, 'issued_participant_cross_space_join_forbidden'),
    `unexpected cross err: ${crossErr.message}`,
  );
  assert(!errIncludes(crossErr, '@participants.internal'), 'email leaked');
  assert(!errIncludes(crossErr, p.loginId), 'loginId leaked');
  assert(crossData == null, 'cross returned data');
  after = await counts(p.uid);
  assert(JSON.stringify(before) === JSON.stringify(after), 'cross mutated memberships');
  const { error: crossErr2 } = await c.rpc('join_space_as_member', {
    p_space_id: other.id,
  });
  assert(crossErr2, 'cross retry should fail');
  after = await counts(p.uid);
  assert(JSON.stringify(before) === JSON.stringify(after), 'cross retry mutated');
  results['5_10_cross'] = { ok: true, message: crossErr.message };

  // 11: revoked
  const rev = await createParticipant({ spaceId: issuing.id });
  await admin
    .from('space_participant_accounts')
    .update({ status: 'revoked' })
    .eq('auth_user_id', rev.uid);
  c = userClient(rev.token);
  before = await counts(rev.uid);
  const { error: revErr } = await c.rpc('join_space_as_member', { p_space_id: issuing.id });
  assert(revErr && errIncludes(revErr, 'issued_participant_scope_unavailable'), 'revoked');
  after = await counts(rev.uid);
  assert(JSON.stringify(before) === JSON.stringify(after), 'revoked mutated');
  results['11_revoked'] = { ok: true };

  // 12: metadata + no active row
  const metaOnlyPass = `QaJ2!${randomBytes(6).toString('base64url')}`;
  const metaEmail = `qaj2-meta-${Date.now()}@participants.internal`;
  const { data: metaUser, error: metaCreateErr } = await admin.auth.admin.createUser({
    email: metaEmail,
    password: metaOnlyPass,
    email_confirm: true,
    app_metadata: { participant: true },
  });
  if (metaCreateErr || !metaUser.user) throw metaCreateErr ?? new Error('meta create');
  created.push(metaUser.user.id);
  const { data: metaSess, error: metaSignErr } = await createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.signInWithPassword({ email: metaEmail, password: metaOnlyPass });
  if (metaSignErr) throw metaSignErr;
  c = userClient(metaSess.session.access_token);
  before = await counts(metaUser.user.id);
  const { error: metaErr } = await c.rpc('join_space_as_member', { p_space_id: issuing.id });
  assert(metaErr && errIncludes(metaErr, 'issued_participant_scope_unavailable'), 'meta-only');
  after = await counts(metaUser.user.id);
  assert(JSON.stringify(before) === JSON.stringify(after), 'meta-only mutated');
  results['12_meta_no_row'] = { ok: true };

  // 13: ambiguous (two active rows) — temporary second spa row
  const amb = await createParticipant({ spaceId: issuing.id });
  const { data: slotRows } = await admin
    .from('space_participant_accounts')
    .select('slot_number')
    .eq('space_id', other.id);
  const usedOther = new Set((slotRows ?? []).map((r) => r.slot_number));
  let slot2 = 1;
  while (usedOther.has(slot2) && slot2 <= 50) slot2 += 1;
  const { error: ambInsErr } = await admin.from('space_participant_accounts').insert({
    space_id: other.id,
    slot_number: slot2,
    login_id: `qaj2-amb-${randomBytes(3).toString('hex')}`,
    auth_user_id: amb.uid,
    auth_email: `amb.${amb.uid}@participants.internal`,
    status: 'active',
  });
  if (ambInsErr) throw ambInsErr;
  c = userClient(amb.token);
  before = await counts(amb.uid);
  const { error: ambErr } = await c.rpc('join_space_as_member', { p_space_id: issuing.id });
  assert(ambErr && errIncludes(ambErr, 'issued_participant_scope_ambiguous'), 'ambiguous');
  after = await counts(amb.uid);
  assert(JSON.stringify(before) === JSON.stringify(after), 'ambiguous mutated');
  results['13_ambiguous'] = { ok: true };

  // 14: issuing_space_missing is defense-in-depth; FK spaces(id) prevents orphan spa.space_id.
  // Confirm the branch is present in the applied function definition.
  const { Client } = await import('pg');
  const dbPass = readFileSync('.supabase-dev-db-password.local', 'utf8').trim();
  const poolerUrl = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
  const parsed = new URL(poolerUrl);
  const pgClient = new Client({
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: dbPass,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();
  const defRes = await pgClient.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'join_space_as_member'
  `);
  await pgClient.end();
  const liveDef = defRes.rows[0]?.def ?? '';
  results['14_missing_space'] = {
    ok: liveDef.includes('issued_participant_issuing_space_missing'),
  };

  // 15: active spa without metadata → still participant (issuing ok, cross forbidden)
  const noMeta = await createParticipant({ spaceId: issuing.id, withMeta: false });
  // recreate session after metadata-less create
  c = userClient(noMeta.token);
  const { error: noMetaOk } = await c.rpc('join_space_as_member', {
    p_space_id: issuing.id,
    p_space_nickname: 'no-meta',
  });
  assert(!noMetaOk, `no-meta issuing: ${noMetaOk?.message}`);
  before = await counts(noMeta.uid);
  const { error: noMetaCross } = await c.rpc('join_space_as_member', { p_space_id: other.id });
  assert(
    noMetaCross && errIncludes(noMetaCross, 'issued_participant_cross_space_join_forbidden'),
    'no-meta cross',
  );
  after = await counts(noMeta.uid);
  assert(JSON.stringify(before) === JSON.stringify(after), 'no-meta cross mutated');
  results['15_spa_without_meta'] = { ok: true };

  // 16-19: regular account
  const regEmail = `qaj2-reg-${Date.now()}@example.test`;
  const regPass = `QaJ2R!${randomBytes(6).toString('base64url')}`;
  const { data: regUser, error: regCreateErr } = await admin.auth.admin.createUser({
    email: regEmail,
    password: regPass,
    email_confirm: true,
  });
  if (regCreateErr || !regUser.user) throw regCreateErr ?? new Error('reg');
  created.push(regUser.user.id);
  const { data: regSess, error: regSignErr } = await createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.signInWithPassword({ email: regEmail, password: regPass });
  if (regSignErr) throw regSignErr;
  c = userClient(regSess.session.access_token);
  before = await counts(regUser.user.id);
  const { error: regJoinErr } = await c.rpc('join_space_as_member', {
    p_space_id: other.id,
    p_space_nickname: 'Regular',
  });
  assert(!regJoinErr, `regular join: ${regJoinErr?.message}`);
  after = await counts(regUser.user.id);
  assert(after.sm.includes(other.id), 'regular sm');
  assert(after.cm.includes(other.community_id), 'regular cm');
  const { error: regAgain } = await c.rpc('join_space_as_member', { p_space_id: other.id });
  assert(!regAgain, 'regular idempotent');
  const afterReg2 = await counts(regUser.user.id);
  assert(afterReg2.sm.length === after.sm.length, 'regular sm grew');
  results['16_19_regular'] = { ok: true };

  // 20-21: unauthenticated / anon
  const anonClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: anonErr } = await anonClient.rpc('join_space_as_member', {
    p_space_id: issuing.id,
  });
  assert(anonErr, 'anon should fail');
  results['20_21_anon'] = { ok: true, message: anonErr.message };

  console.log(JSON.stringify({ results, issuing: issuing.id, other: other.id }, null, 2));
} finally {
  for (const id of created) {
    try {
      await purge(id);
    } catch (e) {
      console.error('cleanup failed', id.slice(0, 8), e.message);
    }
  }
}

const totalsAfter = {
  spa: (await admin.from('space_participant_accounts').select('*', { count: 'exact', head: true }))
    .count,
  sm: (await admin.from('space_memberships').select('*', { count: 'exact', head: true })).count,
  cm: (await admin.from('community_memberships').select('*', { count: 'exact', head: true })).count,
  spaces: (await admin.from('spaces').select('*', { count: 'exact', head: true })).count,
};

const allOk = Object.values(results).every((r) => r.ok);
const totalsMatch = JSON.stringify(totalsBefore) === JSON.stringify(totalsAfter);
console.log(JSON.stringify({ allOk, totalsBefore, totalsAfter, totalsMatch }, null, 2));
process.exit(allOk && totalsMatch ? 0 : 1);
