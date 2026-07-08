#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEV_REF = 'uodaubhlcvvqlgsdxcdf';
const DEV_URL = `https://${DEV_REF}.supabase.co`;

function idSeed(id, salt) {
  let hash = salt;
  for (let i = 0; i < id.length; i += 1) {
    hash = (Math.imul(31, hash) + id.charCodeAt(i)) >>> 0;
  }
  return hash % 1000;
}

function createBubblePositionFromId(id) {
  const seed = idSeed(id, 7919);
  const seed2 = idSeed(id, 6271);
  return { x: 8 + (seed / 1000) * 84, y: 8 + (seed2 / 1000) * 84 };
}

function loadEnv(key) {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() ?? '';
}

const anon = loadEnv('VITE_SUPABASE_ANON_KEY');
const pass = readFileSync('.supabase-dev-auth-password.local', 'utf8').trim();
const service = readFileSync('.supabase-dev-service-role.local', 'utf8').trim();
const admin = createClient(DEV_URL, service, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(DEV_URL, anon);

function uiPayload(uid, nickname) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const pos = createBubblePositionFromId(id);
  return {
    id,
    message: 'Preview UI payload test',
    emotion: 'joy',
    space_id: 'dev-space-public',
    space_pane_id: 'dev-space-public-pane-default',
    author_id: uid,
    author_name: nickname,
    origin: 'manual',
    auto_type: null,
    speech_level: null,
    language: null,
    log_type: 'speech',
    created_at: new Date().toISOString(),
    bubble_color: null,
    hashtags: null,
    image_url: null,
    position_x: pos.x,
    position_y: pos.y,
    is_position_fixed: false,
    scale: 1.0,
    is_hidden: false,
    hidden_at: null,
    hidden_by: null,
    number_value: null,
    like_count: 0,
  };
}

async function main() {
  const { count: beforeTotal } = await admin.from('hossiis').select('*', { count: 'exact', head: true });
  console.log('hossiis_before:', beforeTotal);

  const emails = [
    'dev-super-admin@example.test',
    'dev-user-a@example.test',
    'dev-community-admin@example.test',
  ];

  for (const email of emails) {
    const { error: signErr } = await client.auth.signInWithPassword({ email, password: pass });
    if (signErr) {
      console.log(`${email}: signin FAIL ${signErr.message}`);
      continue;
    }
    const uid = (await client.auth.getUser()).data.user.id;
    const payload = uiPayload(uid, 'TestNick');
    const { data, error } = await client.from('hossiis').insert(payload).select('id').single();
    if (error) {
      console.log(`${email}: insert FAIL`, JSON.stringify({
        status: error.status,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }));
    } else {
      console.log(`${email}: insert OK id=${data.id} author_id=${uid}`);
    }
    await client.auth.signOut();
  }

  // Test with random profile id (old device profile behavior)
  await client.auth.signInWithPassword({ email: 'dev-user-a@example.test', password: pass });
  const fakeProfileId = 'local-device-profile-12345';
  const badPayload = uiPayload(fakeProfileId, 'OldProfile');
  const { error: badErr } = await client.from('hossiis').insert(badPayload);
  console.log('fake profile author_id:', badErr ? `FAIL ${badErr.message}` : 'OK (unexpected)');

  const { count: afterTotal } = await admin.from('hossiis').select('*', { count: 'exact', head: true });
  console.log('hossiis_after:', afterTotal);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
