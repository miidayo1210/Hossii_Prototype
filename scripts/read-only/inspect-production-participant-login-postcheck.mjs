/**
 * READ-ONLY Production postcheck + acceptance (RPC-level) after hotfix apply.
 * Never prints auth_email / login_id / tokens.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLinkedTarget } from '../lib/supabase-target.mjs';

const EXPECTED_PROD = 'wzyoddyvfjkagqpnjejo';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
assertLinkedTarget('production');
const linkedRef = readFileSync(join(repoRoot, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
if (linkedRef !== EXPECTED_PROD) process.exit(2);

function getKeys() {
  const r = spawnSync('supabase', ['projects', 'api-keys', '--project-ref', EXPECTED_PROD, '-o', 'json'], {
    encoding: 'utf8',
  });
  const text = r.stdout + r.stderr;
  const keys = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
  return {
    anon: keys.find((k) => k.id === 'anon')?.api_key,
    service: keys.find((k) => k.id === 'service_role')?.api_key,
  };
}

const { anon, service } = getKeys();
const url = `https://${EXPECTED_PROD}.supabase.co`;

function maskKind(value) {
  if (value == null) return 'null';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid_like';
  if (String(value).endsWith('@participants.internal')) return 'internal_email';
  if (String(value).includes('@')) return 'other_email';
  return 'other';
}

async function restSelect(path, key) {
  const res = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`REST ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function rpc(spaceId, loginId, key = anon) {
  const res = await fetch(`${url}/rest/v1/rpc/resolve_participant_login`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_space_id: spaceId, p_login_id: loginId }),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, kind: maskKind(data) };
}

const pre = JSON.parse(readFileSync('/tmp/hossii-prod-readonly/pre-apply-summary.json', 'utf8'));
const rows = await restSelect(
  '/rest/v1/space_participant_accounts?select=space_id,login_id,auth_email,status,auth_user_id',
  service,
);
const B = {
  total: rows.length,
  auth_email_null: rows.filter((r) => r.auth_email == null).length,
  internal_domain: rows.filter((r) => String(r.auth_email || '').endsWith('@participants.internal')).length,
  other_domain: rows.filter(
    (r) => r.auth_email != null && !String(r.auth_email).endsWith('@participants.internal'),
  ).length,
  active_rows: rows.filter((r) => r.status === 'active').length,
  revoked_rows: rows.filter((r) => r.status === 'revoked').length,
};
const unchanged = {
  total: B.total === pre.B.total,
  active: B.active_rows === pre.B.active_rows,
  revoked: B.revoked_rows === pre.B.revoked_rows,
  auth_email_null: B.auth_email_null === pre.B.auth_email_null,
  internal_domain: B.internal_domain === pre.B.internal_domain,
  other_domain: B.other_domain === pre.B.other_domain,
  login_id_rows: rows.length === pre.C.total_login_id_rows,
};

function fp(rowsIn) {
  const payload = rowsIn
    .map((r) => `${r.space_id}|${r.login_id}|${r.auth_user_id}|${r.auth_email}|${r.status}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(payload).digest('hex');
}
const postFp = fp(rows);

const active = rows.filter((r) => r.status === 'active');
const sample = active[0];
const otherSpace = active.find((r) => r.space_id !== sample.space_id);

const exact = await rpc(sample.space_id, sample.login_id);
const upper = await rpc(sample.space_id, String(sample.login_id).toUpperCase());
const padded = await rpc(sample.space_id, `  ${sample.login_id}  `);
const wrongId = await rpc(sample.space_id, `no-such-login-${Date.now()}`);
const cross = otherSpace
  ? await rpc(otherSpace.space_id, sample.login_id)
  : { kind: 'no_other_space' };

// If cross returns internal_email, that would mean same login_id exists on other space; check equality
const crossOk =
  cross.kind === 'null' ||
  (cross.kind === 'internal_email' &&
    active.some((r) => r.space_id === otherSpace.space_id && r.login_id === sample.login_id));

const functionOk =
  exact.kind === 'internal_email' &&
  upper.kind === 'internal_email' &&
  padded.kind === 'internal_email' &&
  wrongId.kind === 'null' &&
  exact.data === upper.data &&
  exact.data === padded.data;

const spaces = await restSelect('/rest/v1/spaces?select=id,access_mode,is_private,space_type', service);
const byId = Object.fromEntries(spaces.map((s) => [s.id, s]));
const modeCoverage = {
  public: active.some((r) => (byId[r.space_id]?.access_mode ?? 'public') === 'public'),
  private_is_private_flag: active.some((r) => byId[r.space_id]?.is_private === true),
  invite_only: active.some((r) => byId[r.space_id]?.access_mode === 'invite_only'),
};
const modeResolve = {};
for (const [label, pred] of [
  ['public', (r) => (byId[r.space_id]?.access_mode ?? 'public') === 'public'],
  ['private', (r) => byId[r.space_id]?.is_private === true],
  ['invite_only', (r) => byId[r.space_id]?.access_mode === 'invite_only'],
]) {
  const row = active.find(pred);
  if (!row) {
    modeResolve[label] = 'no_active_participant_in_mode';
    continue;
  }
  const r = await rpc(row.space_id, row.login_id);
  modeResolve[label] = r.kind;
}

// Auth login attempts: only if we can resolve and have password — we do not.
// Probe regular email login without password is impossible; skip.

const acceptance = {
  '1_existing_correct_login': {
    result: '未確認',
    reason: 'Production参加IDのパスワード不明。推測・リセット禁止。',
    rpc_support: exact.kind === 'internal_email' ? 'RPC解決は成功(internal_email)' : `RPC=${exact.kind}`,
  },
  '2_newly_issued_login': {
    result: '未確認',
    reason: 'Production管理者資格情報なし。正式発行導線での新規作成不可。',
  },
  '3_whitespace_login_id': {
    result: padded.kind === 'internal_email' ? 'PASS(RPC)' : 'FAIL(RPC)',
    detail: padded.kind,
  },
  '4_case_login_id': {
    result: upper.kind === 'internal_email' ? 'PASS(RPC)' : 'FAIL(RPC)',
    detail: upper.kind,
  },
  '5_wrong_login_id': {
    result: wrongId.kind === 'null' ? 'PASS(RPC)' : 'FAIL(RPC)',
    detail: wrongId.kind,
  },
  '6_wrong_password': {
    result: '未確認',
    reason: '正しい参加IDのパスワード不明のため Auth signIn を実施せず。',
  },
  '7_revoked': {
    result: B.revoked_rows === 0 ? '未確認' : 'PENDING',
    reason: B.revoked_rows === 0 ? 'Productionにrevoked行が0件' : 'revoked行あり（要RPC確認）',
  },
  '8_cross_space': {
    result: cross.kind === 'null' ? 'PASS(RPC)' : crossOk ? 'PASS(RPC same login exists elsewhere)' : 'FAIL(RPC)',
    detail: cross.kind,
  },
  '9_modes': {
    result: modeResolve,
    coverage: modeCoverage,
    note: 'パスワードログインではなくRPC解決の可否。invite_only参加者なしの場合は未確認。',
  },
  '10_email_login': {
    result: '未確認',
    reason: 'Production通常メールのテスト資格情報なし。本migrationは当該経路を変更しない。',
  },
};

const mig = spawnSync('supabase', ['migration', 'list'], { encoding: 'utf8' });
const applied = /20260726220000\s*\|\s*20260726220000/.test(mig.stdout + mig.stderr);

console.log(
  JSON.stringify(
    {
      post_B: B,
      pre_B: pre.B,
      unchanged,
      value_fingerprint_sha256: postFp,
      function_behavior_ok: functionOk,
      resolve_kinds: {
        exact: exact.kind,
        upper: upper.kind,
        padded: padded.kind,
        wrongId: wrongId.kind,
        cross: cross.kind,
      },
      migration_applied_on_remote: applied,
      acceptance,
    },
    null,
    2,
  ),
);

if (!functionOk || !Object.values(unchanged).every(Boolean) || !applied) process.exit(11);
