/**
 * READ-ONLY Production precheck for resolve_participant_login hotfix.
 * - Confirms CLI is linked to Production
 * - Uses projects api-keys via CLI (never printed)
 * - Aggregates via PostgREST (no raw auth_email/login_id printed)
 * - Infers broken function behavior via anon RPC shape checks
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLinkedTarget } from '../lib/supabase-target.mjs';

const EXPECTED_PROD = 'wzyoddyvfjkagqpnjejo';
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const tmpDir = '/tmp/hossii-prod-readonly';
mkdirSync(tmpDir, { recursive: true });

const { linkedRef, expected } = assertLinkedTarget('production');
if (linkedRef !== EXPECTED_PROD) {
  console.error(`ABORT: linked ${linkedRef}, expected ${EXPECTED_PROD}`);
  process.exit(2);
}

const linkedMeta = JSON.parse(
  readFileSync(join(repoRoot, 'supabase', '.temp', 'linked-project.json'), 'utf8'),
);
const poolerUser = decodeURIComponent(
  new URL(readFileSync(join(repoRoot, 'supabase', '.temp', 'pooler-url'), 'utf8').trim()).username,
);

console.log(
  JSON.stringify(
    {
      dashboardName: linkedMeta.name,
      configLabel: expected.label,
      projectRef: linkedRef,
      url: `https://${linkedRef}.supabase.co`,
      poolerUser,
      productionEvidence: {
        projectRefMatchesConfig: linkedRef === expected.projectRef,
        poolerUserMatchesRef: poolerUser === `postgres.${EXPECTED_PROD}`,
        assertLinkedTargetProduction: true,
        note: 'Dashboard display name is still "Hossii test DB"; config label is Hossii Production (legacy rename).',
      },
    },
    null,
    2,
  ),
);

function getKeys() {
  const r = spawnSync('supabase', ['projects', 'api-keys', '--project-ref', EXPECTED_PROD, '-o', 'json'], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('api-keys failed', r.stderr);
    process.exit(3);
  }
  const text = r.stdout + r.stderr;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end < 0) {
    console.error('api-keys JSON not found');
    process.exit(3);
  }
  const keys = JSON.parse(text.slice(start, end + 1));
  const anon = keys.find((k) => k.id === 'anon' || k.name === 'anon')?.api_key;
  const service = keys.find((k) => k.id === 'service_role' || k.name === 'service_role')?.api_key;
  if (!anon || !service) {
    console.error('missing anon/service_role keys');
    process.exit(3);
  }
  return { anon, service };
}

const { anon, service } = getKeys();
const url = `https://${EXPECTED_PROD}.supabase.co`;

async function rest(path, { key, method = 'GET', prefer } = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${url}${path}`, { method, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
}

function maskKind(value) {
  if (value == null) return 'null';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return 'uuid_like';
  }
  if (String(value).endsWith('@participants.internal')) return 'internal_email';
  if (String(value).includes('@')) return 'other_email';
  return 'other';
}

// B/C: pull only needed columns; never print values
const rowsResp = await rest(
  '/rest/v1/space_participant_accounts?select=space_id,login_id,auth_email,status,auth_user_id',
  { key: service },
);
if (!rowsResp.res.ok) {
  console.error('FAILED to read space_participant_accounts', rowsResp.res.status, rowsResp.data);
  process.exit(3);
}
const rows = Array.isArray(rowsResp.data) ? rowsResp.data : [];
const B = {
  total: rows.length,
  auth_email_null: rows.filter((r) => r.auth_email == null).length,
  internal_domain: rows.filter(
    (r) => typeof r.auth_email === 'string' && r.auth_email.endsWith('@participants.internal'),
  ).length,
  other_domain: rows.filter(
    (r) =>
      r.auth_email != null &&
      !(typeof r.auth_email === 'string' && r.auth_email.endsWith('@participants.internal')),
  ).length,
  active_rows: rows.filter((r) => r.status === 'active').length,
  revoked_rows: rows.filter((r) => r.status === 'revoked').length,
};
const C = {
  needs_normalize: rows.filter(
    (r) => typeof r.login_id === 'string' && r.login_id !== r.login_id.toLowerCase().trim(),
  ).length,
  total_login_id_rows: rows.length,
};
console.log('===== B =====');
console.log(JSON.stringify(B, null, 2));
console.log('===== C =====');
console.log(JSON.stringify(C, null, 2));

if (B.other_domain > 0 || B.auth_email_null > 0) {
  console.log('STOP_CONDITION: auth_email domain/null check failed');
}
if (C.needs_normalize > 0) {
  console.log('STOP_CONDITION: login_id normalize check failed');
}

// A behavioral inference (cannot pg_get_functiondef without SQL channel)
const active = rows.filter((r) => r.status === 'active');
const revoked = rows.filter((r) => r.status === 'revoked');
const sample = active[0];
if (!sample) {
  console.error('No active participant rows; cannot infer function behavior');
  process.exit(3);
}

async function rpcResolve(loginId, spaceId, key = anon) {
  const { res, data } = await rest('/rest/v1/rpc/resolve_participant_login', {
    key,
    method: 'POST',
  });
  // PostgREST RPC needs body
  const res2 = await fetch(`${url}/rest/v1/rpc/resolve_participant_login`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ p_space_id: spaceId, p_login_id: loginId }),
  });
  const text = await res2.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res2.status, data: parsed, kind: maskKind(parsed) };
}

const exact = await rpcResolve(sample.login_id, sample.space_id, anon);
const upper = await rpcResolve(String(sample.login_id).toUpperCase(), sample.space_id, anon);
const padded = await rpcResolve(`  ${sample.login_id}  `, sample.space_id, anon);
const wrongSpace = await rpcResolve(
  sample.login_id,
  active.find((r) => r.space_id !== sample.space_id)?.space_id ?? `${sample.space_id}__nope`,
  anon,
);
const revokedSample = revoked[0];
const revokedResolve = revokedSample
  ? await rpcResolve(revokedSample.login_id, revokedSample.space_id, anon)
  : { kind: 'no_revoked_row' };

// access_mode probe for can_access_space gating
const spacesResp = await rest('/rest/v1/spaces?select=id,access_mode,is_private,space_type', {
  key: service,
});
const spaces = Array.isArray(spacesResp.data) ? spacesResp.data : [];
const byId = Object.fromEntries(spaces.map((s) => [s.id, s]));
const inviteOnlyWithActive = active.find((r) => byId[r.space_id]?.access_mode === 'invite_only');
const inviteResolve = inviteOnlyWithActive
  ? await rpcResolve(inviteOnlyWithActive.login_id, inviteOnlyWithActive.space_id, anon)
  : null;

const A = {
  method: 'behavioral_inference_via_anon_rpc',
  note: 'SQL pg_get_functiondef unavailable without Management SQL channel; infer from RPC return shape.',
  expectedBroken: {
    returns: 'auth_user_id::text (uuid_like)',
    has_can_access_space: true,
    login_id_compare: 'exact (no lower/trim)',
    security: 'SECURITY DEFINER (assumed from prior migrations; not re-verified via catalog)',
  },
  observed: {
    exact_match_kind: exact.kind,
    exact_status: exact.status,
    uppercase_kind: upper.kind,
    padded_kind: padded.kind,
    wrong_space_kind: wrongSpace.kind,
    revoked_kind: revokedResolve.kind,
    invite_only_anon_kind: inviteResolve?.kind ?? 'no_invite_only_active_participant',
    matches_uuid_return: exact.kind === 'uuid_like',
    suggests_no_lower_trim: exact.kind !== 'null' && upper.kind === 'null' && padded.kind === 'null',
    suggests_can_access_space_gate:
      inviteResolve != null ? inviteResolve.kind === 'null' && exact.kind === 'uuid_like' : 'unknown',
  },
  overload_check: 'single RPC signature resolve_participant_login(p_space_id,p_login_id) callable',
};

console.log('===== A_behavior =====');
console.log(JSON.stringify(A, null, 2));

// D from migration list already known; reconfirm via CLI parse
const mig = spawnSync('supabase', ['migration', 'list'], { encoding: 'utf8' });
const migText = mig.stdout + mig.stderr;
const pending = [];
for (const line of migText.split('\n')) {
  const m = line.match(/^\s*(\d{14})\s*\|\s*\|/);
  if (m) pending.push(m[1]);
}
console.log('===== D_pending_remote =====');
console.log(JSON.stringify({ pending }, null, 2));

const stop =
  B.other_domain > 0 ||
  B.auth_email_null > 0 ||
  C.needs_normalize > 0 ||
  pending.length !== 1 ||
  pending[0] !== '20260726220000' ||
  exact.kind !== 'uuid_like';

console.log(
  JSON.stringify(
    {
      stop,
      stopReasons: {
        other_domain: B.other_domain > 0,
        auth_email_null: B.auth_email_null > 0,
        needs_normalize: C.needs_normalize > 0,
        pending_not_only_target: !(pending.length === 1 && pending[0] === '20260726220000'),
        return_not_uuid_like: exact.kind !== 'uuid_like',
      },
    },
    null,
    2,
  ),
);

writeFileSync(join(tmpDir, 'precheck-summary.json'), JSON.stringify({ A, B, C, pending, stop }, null, 2));
console.log('precheck complete');
process.exit(stop ? 10 : 0);
