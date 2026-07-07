#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertLinkedTarget } from './lib/supabase-target.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const { expected } = assertLinkedTarget('development');
const { projectRef } = expected;
const serviceRolePath = join(repoRoot, '.supabase-dev-service-role.local');
const passwordPath = join(repoRoot, '.supabase-dev-auth-password.local');

if (!existsSync(serviceRolePath)) {
  console.error('[db:seed:dev] Missing .supabase-dev-service-role.local');
  process.exit(1);
}

const serviceRoleKey = readFileSync(serviceRolePath, 'utf8').trim();
const supabaseUrl = `https://${projectRef}.supabase.co`;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_USERS = [
  {
    email: 'dev-super-admin@example.test',
    appMetadata: { role: 'super_admin' },
    userMetadata: { display_name: 'Dev Super Admin' },
  },
  {
    email: 'dev-community-admin@example.test',
    appMetadata: { role: 'admin' },
    userMetadata: { display_name: 'Dev Community Admin' },
  },
  {
    email: 'dev-user-a@example.test',
    appMetadata: {},
    userMetadata: { display_name: 'Dev User A' },
  },
  {
    email: 'dev-user-b@example.test',
    appMetadata: {},
    userMetadata: { display_name: 'Dev User B' },
  },
  {
    email: 'dev-user-same-name@example.test',
    appMetadata: {},
    userMetadata: { display_name: 'Dev Same Name' },
  },
];

const PARTICIPANT_USERS = [
  { spaceId: 'dev-space-public', loginId: 'public-01', slotNumber: 1, status: 'active' },
  { spaceId: 'dev-space-public', loginId: 'public-02', slotNumber: 2, status: 'revoked' },
];

const SPACES = [
  {
    id: 'dev-space-public',
    name: 'Dev Public Space',
    space_url: 'dev-public',
    is_private: false,
    my_hossii_enabled: true,
    my_hossii_motion_mode: 'free',
    my_hossii_log_visibility: 'public',
    background: { kind: 'color', value: '#EAF4FF' },
  },
  {
    id: 'dev-space-private',
    name: 'Dev Private Space',
    space_url: 'dev-private',
    is_private: true,
    my_hossii_enabled: false,
    my_hossii_motion_mode: 'auto',
    my_hossii_log_visibility: 'authenticated',
    background: { kind: 'color', value: '#F5E6FF' },
  },
  {
    id: 'dev-space-my-on',
    name: 'Dev My Hossii ON',
    space_url: 'dev-my-on',
    is_private: false,
    my_hossii_enabled: true,
    my_hossii_motion_mode: 'anchored',
    my_hossii_log_visibility: 'public',
    background: { kind: 'color', value: '#FFF4E6' },
  },
  {
    id: 'dev-space-my-off',
    name: 'Dev My Hossii OFF',
    space_url: 'dev-my-off',
    is_private: false,
    my_hossii_enabled: false,
    my_hossii_motion_mode: 'auto',
    my_hossii_log_visibility: 'hidden',
    background: { kind: 'color', value: '#E8FFF0' },
  },
  {
    id: 'dev-space-motion',
    name: 'Dev Motion Mode',
    space_url: 'dev-motion',
    is_private: false,
    my_hossii_enabled: true,
    my_hossii_motion_mode: 'free',
    my_hossii_log_visibility: 'public',
    background: { kind: 'color', value: '#FFE8F0' },
  },
  {
    id: 'dev-space-log-vis',
    name: 'Dev Log Visibility',
    space_url: 'dev-log-vis',
    is_private: false,
    my_hossii_enabled: true,
    my_hossii_motion_mode: 'auto',
    my_hossii_log_visibility: 'authenticated',
    background: { kind: 'color', value: '#E6F7FF' },
  },
];

function buildAuthEmail(spaceId, loginId) {
  const safeLoginId = loginId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `${spaceId}.${safeLoginId}@participants.internal`;
}

function getOrCreateDevPassword() {
  if (existsSync(passwordPath)) {
    return readFileSync(passwordPath, 'utf8').trim();
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  for (let i = 0; i < 20; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  writeFileSync(passwordPath, `${password}\n`, { mode: 0o600 });
  console.log('[db:seed:dev] Generated dev auth password in .supabase-dev-auth-password.local');
  return password;
}

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

function userIdByEmail(users, email) {
  const user = users.find((entry) => entry.email === email);
  if (!user) throw new Error(`Missing auth user: ${email}`);
  return user.id;
}

async function ensureAuthUser(definition, password, existingUsers) {
  const existing = existingUsers.find((user) => user.email === definition.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`updateUser failed for ${definition.email}: ${error.message}`);
    }
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: definition.email,
    password,
    email_confirm: true,
    app_metadata: definition.appMetadata,
    user_metadata: definition.userMetadata,
  });

  if (error || !data.user) {
    throw new Error(`createUser failed for ${definition.email}: ${error?.message ?? 'unknown'}`);
  }

  return data.user;
}

async function ensureParticipantUser(definition, password, existingUsers) {
  const authEmail = buildAuthEmail(definition.spaceId, definition.loginId);
  const existing = existingUsers.find((entry) => entry.email === authEmail);
  if (existing) return existing;

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    app_metadata: { participant: true },
    user_metadata: { display_name: `Participant ${definition.loginId}` },
  });
  if (error || !data.user) {
    throw new Error(`create participant failed: ${error?.message ?? 'unknown'}`);
  }

  return data.user;
}

async function applyDevelopmentSeed(users) {
  const superAdminId = userIdByEmail(users, 'dev-super-admin@example.test');
  const communityAdminId = userIdByEmail(users, 'dev-community-admin@example.test');
  const userAId = userIdByEmail(users, 'dev-user-a@example.test');
  const userBId = userIdByEmail(users, 'dev-user-b@example.test');
  const sameNameId = userIdByEmail(users, 'dev-user-same-name@example.test');
  const participantActiveId = userIdByEmail(
    users,
    'dev-space-public.public-01@participants.internal',
  );
  const participantRevokedId = userIdByEmail(
    users,
    'dev-space-public.public-02@participants.internal',
  );

  const { error: profileError } = await admin.from('user_profiles').upsert([
    {
      id: superAdminId,
      username: 'Dev Super Admin',
      hossii_source_type: 'preset',
      hossii_preset_key: 'idle_base',
      hossii_updated_at: new Date().toISOString(),
    },
    {
      id: communityAdminId,
      username: 'Dev Community Admin',
      hossii_source_type: 'preset',
      hossii_preset_key: 'idle_smile',
      hossii_updated_at: new Date().toISOString(),
    },
    {
      id: userAId,
      username: 'Dev User A',
      hossii_source_type: 'preset',
      hossii_preset_key: 'idle_base',
      hossii_updated_at: new Date().toISOString(),
    },
    {
      id: userBId,
      username: 'Dev User B',
      hossii_source_type: null,
      hossii_preset_key: null,
      hossii_updated_at: null,
    },
    {
      id: sameNameId,
      username: 'Dev Same Name',
      hossii_source_type: 'custom',
      hossii_preset_key: null,
      hossii_updated_at: new Date().toISOString(),
      hossii_custom_config: { version: 1, baseKey: 'idle_closingeye', parts: {} },
    },
  ]);
  if (profileError) throw new Error(`user_profiles upsert failed: ${profileError.message}`);

  const { error: legacyProfilesError } = await admin.from('profiles').upsert([
    { id: superAdminId, default_nickname: 'Dev Super Admin' },
    { id: communityAdminId, default_nickname: 'Dev Community Admin' },
    { id: userAId, default_nickname: 'Dev User A' },
    { id: userBId, default_nickname: 'Dev User B' },
    { id: sameNameId, default_nickname: 'Dev Same Name' },
    { id: participantActiveId, default_nickname: 'Participant public-01' },
    { id: participantRevokedId, default_nickname: 'Participant public-02' },
  ]);
  if (legacyProfilesError) {
    throw new Error(`profiles upsert failed: ${legacyProfilesError.message}`);
  }

  const { data: existingCommunity, error: communityLookupError } = await admin
    .from('communities')
    .select('id')
    .eq('admin_id', communityAdminId)
    .maybeSingle();
  if (communityLookupError) {
    throw new Error(`community lookup failed: ${communityLookupError.message}`);
  }

  let communityId = existingCommunity?.id;
  if (!communityId) {
    const { data: createdCommunity, error: communityInsertError } = await admin
      .from('communities')
      .insert({
        admin_id: communityAdminId,
        name: 'Dev Community',
        slug: 'dev-community',
        status: 'approved',
      })
      .select('id')
      .single();
    if (communityInsertError || !createdCommunity) {
      throw new Error(`community insert failed: ${communityInsertError?.message ?? 'unknown'}`);
    }
    communityId = createdCommunity.id;
  }

  const { error: spacesError } = await admin.from('spaces').upsert(
    SPACES.map((space) => ({
      ...space,
      community_id: communityId,
      quick_emotions: ['joy', 'wow', 'think', 'empathy', 'inspire', 'laugh', 'moved', 'fun'],
    })),
  );
  if (spacesError) throw new Error(`spaces upsert failed: ${spacesError.message}`);

  const { error: settingsError } = await admin.from('space_settings').upsert(
    SPACES.map((space) => ({ space_id: space.id })),
  );
  if (settingsError) throw new Error(`space_settings upsert failed: ${settingsError.message}`);

  const { error: nicknamesError } = await admin.from('space_nicknames').upsert([
    { profile_id: userAId, space_id: 'dev-space-public', nickname: 'ほっしー太郎' },
    { profile_id: sameNameId, space_id: 'dev-space-public', nickname: 'ほっしー太郎' },
    { profile_id: userBId, space_id: 'dev-space-public', nickname: 'Dev User B' },
    { profile_id: communityAdminId, space_id: 'dev-space-public', nickname: 'Community Admin' },
    { profile_id: userAId, space_id: 'dev-space-my-on', nickname: 'Dev User A' },
  ]);
  if (nicknamesError) throw new Error(`space_nicknames upsert failed: ${nicknamesError.message}`);

  const { error: prefError } = await admin.from('space_my_hossii_preferences').upsert({
    space_id: 'dev-space-my-on',
    user_id: userAId,
    is_visible: false,
  });
  if (prefError) {
    throw new Error(`space_my_hossii_preferences upsert failed: ${prefError.message}`);
  }

  const { error: participantError } = await admin.from('space_participant_accounts').upsert([
    {
      space_id: 'dev-space-public',
      slot_number: 1,
      login_id: 'public-01',
      auth_user_id: participantActiveId,
      auth_email: 'dev-space-public.public-01@participants.internal',
      status: 'active',
      issued_by: communityAdminId,
    },
    {
      space_id: 'dev-space-public',
      slot_number: 2,
      login_id: 'public-02',
      auth_user_id: participantRevokedId,
      auth_email: 'dev-space-public.public-02@participants.internal',
      status: 'revoked',
      issued_by: communityAdminId,
    },
  ]);
  if (participantError) {
    throw new Error(`space_participant_accounts upsert failed: ${participantError.message}`);
  }

  const { error: deletePostsError } = await admin
    .from('hossiis')
    .delete()
    .like('space_id', 'dev-space-%');
  if (deletePostsError) throw new Error(`hossiis delete failed: ${deletePostsError.message}`);

  const now = Date.now();
  const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();
  const daysAgo = (days) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const { error: postsError } = await admin.from('hossiis').insert([
    {
      id: 'dev-post-001',
      message: '今日は開発環境のテスト投稿です。',
      emotion: 'joy',
      space_id: 'dev-space-public',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(12),
    },
    {
      id: 'dev-post-002',
      message: '架空の気持ちを共有します。',
      emotion: 'wow',
      space_id: 'dev-space-public',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(10),
    },
    {
      id: 'dev-post-003',
      message: '感情なしメッセージの例です。',
      emotion: null,
      space_id: 'dev-space-public',
      author_id: communityAdminId,
      author_name: 'Community Admin',
      origin: 'manual',
      created_at: daysAgo(9),
    },
    {
      id: 'dev-post-004',
      message: 'モーション確認用の投稿。',
      emotion: 'fun',
      space_id: 'dev-space-motion',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(8),
    },
    {
      id: 'dev-post-005',
      message: 'ログ公開範囲テスト。',
      emotion: 'empathy',
      space_id: 'dev-space-log-vis',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(7),
    },
    {
      id: 'dev-post-006',
      message: 'My Hossii ON スペース向け。',
      emotion: 'inspire',
      space_id: 'dev-space-my-on',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(6),
    },
    {
      id: 'dev-post-007',
      message: '非公開スペースの投稿。',
      emotion: 'moved',
      space_id: 'dev-space-private',
      author_id: communityAdminId,
      author_name: 'Community Admin',
      origin: 'manual',
      created_at: daysAgo(5),
    },
    {
      id: 'dev-post-008',
      message: '古い日時の投稿サンプル。',
      emotion: 'think',
      space_id: 'dev-space-public',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(30),
    },
    {
      id: 'dev-post-009',
      message: '新しい投稿サンプル。',
      emotion: 'laugh',
      space_id: 'dev-space-public',
      author_id: sameNameId,
      author_name: 'Dev Same Name',
      origin: 'manual',
      created_at: hoursAgo(1),
    },
    {
      id: 'dev-post-010',
      message: '同名ニックネーム確認用。',
      emotion: 'joy',
      space_id: 'dev-space-public',
      author_id: sameNameId,
      author_name: 'ほっしー太郎',
      origin: 'manual',
      created_at: hoursAgo(0.8),
    },
    {
      id: 'dev-post-011',
      message: '投稿ゼロユーザー向けスペース外投稿。',
      emotion: 'wow',
      space_id: 'dev-space-my-off',
      author_id: communityAdminId,
      author_name: 'Community Admin',
      origin: 'manual',
      created_at: daysAgo(4),
    },
    {
      id: 'dev-post-012',
      message: 'もう一つの架空投稿。',
      emotion: 'fun',
      space_id: 'dev-space-public',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: daysAgo(3),
    },
    {
      id: 'dev-post-013',
      message: '開発用テストデータ。',
      emotion: 'empathy',
      space_id: 'dev-space-motion',
      author_id: sameNameId,
      author_name: 'Dev Same Name',
      origin: 'manual',
      created_at: daysAgo(2),
    },
    {
      id: 'dev-post-014',
      message: '最近の投稿。',
      emotion: 'inspire',
      space_id: 'dev-space-log-vis',
      author_id: communityAdminId,
      author_name: 'Community Admin',
      origin: 'manual',
      created_at: hoursAgo(20),
    },
    {
      id: 'dev-post-015',
      message: '最後のサンプル投稿。',
      emotion: 'moved',
      space_id: 'dev-space-public',
      author_id: userAId,
      author_name: 'Dev User A',
      origin: 'manual',
      created_at: hoursAgo(0.25),
    },
  ]);
  if (postsError) throw new Error(`hossiis insert failed: ${postsError.message}`);
}

async function main() {
  const password = getOrCreateDevPassword();
  let users = await listAllUsers();

  for (const definition of DEV_USERS) {
    await ensureAuthUser(definition, password, users);
  }

  users = await listAllUsers();
  for (const definition of PARTICIPANT_USERS) {
    await ensureParticipantUser(definition, password, users);
  }

  users = await listAllUsers();
  await applyDevelopmentSeed(users);
  console.log('[db:seed:dev] Development seed completed.');
}

main().catch((error) => {
  console.error('[db:seed:dev]', error.message);
  process.exit(1);
});
