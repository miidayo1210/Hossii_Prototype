#!/usr/bin/env node
/**
 * READ-ONLY real-auth verification of get_my_space_activity on DEVELOPMENT.
 *
 * Signs in real dev users (no data writes) and calls the RPC, then cross-checks
 * post_count against a service-role ground-truth query using the same predicate:
 *   - hossii_authorships.auth_user_id = <uid>   (本人性の正本, author_id へ fallback しない)
 *   - hossiis.space_id = <space>                (他 space 除外)
 *   - deleted_at IS NULL                        (soft delete 除外)
 *   - COALESCE(is_hidden,false)=false           (管理者非表示除外)
 * Also verifies anon (no session) cannot EXECUTE the RPC.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;

function loadEnv(key) {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() ?? '';
}

const anonKey = loadEnv('VITE_SUPABASE_ANON_KEY');
const pass = readFileSync('.supabase-dev-auth-password.local', 'utf8').trim();
const service = readFileSync('.supabase-dev-service-role.local', 'utf8').trim();

const admin = createClient(DEV_URL, service, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(DEV_URL, anonKey);

async function groundTruthCount(uid, spaceId) {
  // service-role ground truth: 本人 authorship を持つ、非削除・非hidden の投稿数（全 Pane）
  const { data, error } = await admin
    .from('hossii_authorships')
    .select('hossii_id, hossiis!inner(space_id, deleted_at, is_hidden)')
    .eq('auth_user_id', uid)
    .eq('hossiis.space_id', spaceId)
    .is('hossiis.deleted_at', null);
  if (error) throw new Error(`ground truth failed: ${error.message}`);
  return (data ?? []).filter((r) => r.hossiis && r.hossiis.is_hidden !== true).length;
}

async function main() {
  const results = [];

  // 1) anon (no session) must NOT be able to execute the RPC.
  const anonClient = createClient(DEV_URL, anonKey);
  const { data: anonData, error: anonErr } = await anonClient.rpc('get_my_space_activity', {
    p_space_id: 'dev-space-public',
  });
  results.push({
    case: 'anon_execute_denied',
    denied: !!anonErr,
    error: anonErr?.message ?? null,
    data: anonData ?? null,
  });

  // 2) authenticated users: RPC post_count matches service-role ground truth.
  const spaces = ['dev-space-public'];
  const emails = ['dev-user-a@example.test', 'dev-community-admin@example.test'];

  for (const email of emails) {
    const { error: signErr } = await client.auth.signInWithPassword({ email, password: pass });
    if (signErr) {
      results.push({ case: `signin:${email}`, ok: false, error: signErr.message });
      continue;
    }
    const uid = (await client.auth.getUser()).data.user.id;

    for (const spaceId of spaces) {
      const { data, error } = await client.rpc('get_my_space_activity', { p_space_id: spaceId });
      if (error) {
        results.push({ case: `rpc:${email}:${spaceId}`, ok: false, error: error.message });
        continue;
      }
      const expected = await groundTruthCount(uid, spaceId);
      const recent = Array.isArray(data?.recent) ? data.recent : [];
      results.push({
        case: `rpc:${email}:${spaceId}`,
        rpc_post_count: data?.post_count ?? null,
        ground_truth_count: expected,
        match: (data?.post_count ?? null) === expected,
        recent_len: recent.length,
        recent_capped_ok: recent.length <= 3,
        recent_has_only_id_message_created_emotion: recent.every(
          (r) => Object.keys(r).sort().join(',') === 'created_at,emotion,id,message',
        ),
      });
    }
    await client.auth.signOut();
  }

  console.log(JSON.stringify(results, null, 2));

  const failures = results.filter(
    (r) =>
      (r.case === 'anon_execute_denied' && !r.denied) ||
      (r.case.startsWith('rpc:') && r.match === false) ||
      r.ok === false,
  );
  if (failures.length > 0) {
    console.error(`\nFAILURES: ${failures.length}`);
    process.exit(1);
  }
  console.error('\nALL CHECKS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
