#!/usr/bin/env node
/**
 * Development テスト Auth ユーザーのパスワードを .supabase-dev-auth-password.local と同期する。
 * Production には接続しない。
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertLinkedTarget } from './lib/supabase-target.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const { expected } = assertLinkedTarget('development');
const { projectRef } = expected;
const passwordPath = join(repoRoot, '.supabase-dev-auth-password.local');
const serviceRolePath = join(repoRoot, '.supabase-dev-service-role.local');

const TEST_EMAILS = [
  'dev-super-admin@example.test',
  'dev-community-admin@example.test',
  'dev-user-a@example.test',
  'dev-user-b@example.test',
  'dev-user-same-name@example.test',
];

if (!existsSync(passwordPath) || !existsSync(serviceRolePath)) {
  console.error('[reset-dev-auth] Missing local secret files');
  process.exit(1);
}

const password = readFileSync(passwordPath, 'utf8').trim();
const serviceRoleKey = readFileSync(serviceRolePath, 'utf8').trim();
const supabaseUrl = `https://${projectRef}.supabase.co`;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function main() {
  const users = await listAllUsers();
  for (const email of TEST_EMAILS) {
    const user = users.find((entry) => entry.email === email);
    if (!user) {
      console.error(`[reset-dev-auth] missing user: ${email}`);
      process.exit(1);
    }
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`[reset-dev-auth] update failed for ${email}: ${error.message}`);
      process.exit(1);
    }
    console.log(`[reset-dev-auth] synced: ${email}`);
  }

  const anon = readFileSync(join(repoRoot, '.env.local'), 'utf8')
    .split('\n')
    .find((line) => line.startsWith('VITE_SUPABASE_ANON_KEY='))
    ?.slice('VITE_SUPABASE_ANON_KEY='.length)
    .trim();
  if (!anon) {
    console.error('[reset-dev-auth] missing VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, anon);
  const { error: signErr } = await client.auth.signInWithPassword({
    email: 'dev-super-admin@example.test',
    password,
  });
  if (signErr) {
    console.error('[reset-dev-auth] login verify failed:', signErr.message);
    process.exit(1);
  }
  console.log('[reset-dev-auth] dev-super-admin login OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
