-- Development-only seed data for Hossii Development Supabase project.
-- Auth users must exist before running (created by scripts/seed-development.mjs).
-- Never run against Production. scripts/seed-development.mjs enforces the linked ref.

DO $$
DECLARE
  v_super_admin_id uuid;
  v_community_admin_id uuid;
  v_user_a_id uuid;
  v_user_b_id uuid;
  v_same_name_id uuid;
  v_participant_active_id uuid;
  v_participant_revoked_id uuid;
  v_community_id uuid;
BEGIN
  SELECT id INTO v_super_admin_id FROM auth.users WHERE email = 'dev-super-admin@example.test' LIMIT 1;
  SELECT id INTO v_community_admin_id FROM auth.users WHERE email = 'dev-community-admin@example.test' LIMIT 1;
  SELECT id INTO v_user_a_id FROM auth.users WHERE email = 'dev-user-a@example.test' LIMIT 1;
  SELECT id INTO v_user_b_id FROM auth.users WHERE email = 'dev-user-b@example.test' LIMIT 1;
  SELECT id INTO v_same_name_id FROM auth.users WHERE email = 'dev-user-same-name@example.test' LIMIT 1;
  SELECT id INTO v_participant_active_id
  FROM auth.users
  WHERE email = 'dev-space-public.public-01@participants.internal'
  LIMIT 1;
  SELECT id INTO v_participant_revoked_id
  FROM auth.users
  WHERE email = 'dev-space-public.public-02@participants.internal'
  LIMIT 1;

  IF v_super_admin_id IS NULL OR v_community_admin_id IS NULL OR v_user_a_id IS NULL OR v_user_b_id IS NULL OR v_same_name_id IS NULL THEN
    RAISE EXCEPTION 'Required dev auth users are missing. Run scripts/seed-development.mjs first.';
  END IF;

  -- user_profiles
  INSERT INTO user_profiles (id, username, hossii_source_type, hossii_preset_key, hossii_updated_at, hossii_custom_config)
  VALUES
    (v_super_admin_id, 'Dev Super Admin', 'preset', 'idle_base', now(), NULL),
    (v_community_admin_id, 'Dev Community Admin', 'preset', 'idle_smile', now(), NULL),
    (v_user_a_id, 'Dev User A', 'preset', 'idle_base', now(), NULL),
    (v_user_b_id, 'Dev User B', NULL, NULL, NULL, NULL),
    (v_same_name_id, 'Dev Same Name', 'custom', NULL, now(), '{"version":1,"baseKey":"idle_closingeye","parts":{}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    hossii_source_type = EXCLUDED.hossii_source_type,
    hossii_preset_key = EXCLUDED.hossii_preset_key,
    hossii_updated_at = EXCLUDED.hossii_updated_at,
    hossii_custom_config = EXCLUDED.hossii_custom_config;

  -- community
  SELECT id INTO v_community_id FROM communities WHERE admin_id = v_community_admin_id LIMIT 1;
  IF v_community_id IS NULL THEN
    INSERT INTO communities (admin_id, name, slug, status)
    VALUES (v_community_admin_id, 'Dev Community', 'dev-community', 'approved')
    RETURNING id INTO v_community_id;
  END IF;

  -- spaces
  INSERT INTO spaces (
    id, name, space_url, community_id, is_private,
    my_hossii_enabled, my_hossii_motion_mode, my_hossii_log_visibility,
    background, card_type, quick_emotions
  ) VALUES
    ('dev-space-public', 'Dev Public Space', 'dev-public', v_community_id, false, true, 'free', 'public',
      '{"kind":"color","value":"#EAF4FF"}'::jsonb, 'constellation', ARRAY['joy','wow','think','empathy']),
    ('dev-space-private', 'Dev Private Space', 'dev-private', v_community_id, true, false, 'auto', 'authenticated',
      '{"kind":"color","value":"#F5E6FF"}'::jsonb, 'constellation', ARRAY['joy','moved']),
    ('dev-space-my-on', 'Dev My Hossii ON', 'dev-my-on', v_community_id, false, true, 'anchored', 'public',
      '{"kind":"color","value":"#FFF4E6"}'::jsonb, 'constellation', ARRAY['joy','fun']),
    ('dev-space-my-off', 'Dev My Hossii OFF', 'dev-my-off', v_community_id, false, false, 'auto', 'hidden',
      '{"kind":"color","value":"#E8FFF0"}'::jsonb, 'constellation', ARRAY['think','inspire']),
    ('dev-space-motion', 'Dev Motion Mode', 'dev-motion', v_community_id, false, true, 'free', 'public',
      '{"kind":"color","value":"#FFE8F0"}'::jsonb, 'constellation', ARRAY['wow','laugh']),
    ('dev-space-log-vis', 'Dev Log Visibility', 'dev-log-vis', v_community_id, false, true, 'auto', 'authenticated',
      '{"kind":"color","value":"#E6F7FF"}'::jsonb, 'constellation', ARRAY['empathy','moved'])
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    space_url = EXCLUDED.space_url,
    community_id = EXCLUDED.community_id,
    is_private = EXCLUDED.is_private,
    my_hossii_enabled = EXCLUDED.my_hossii_enabled,
    my_hossii_motion_mode = EXCLUDED.my_hossii_motion_mode,
    my_hossii_log_visibility = EXCLUDED.my_hossii_log_visibility;

  INSERT INTO space_settings (space_id)
  SELECT id FROM spaces WHERE id LIKE 'dev-space-%'
  ON CONFLICT (space_id) DO NOTHING;

  -- nicknames (same nickname pair on public space)
  INSERT INTO space_nicknames (profile_id, space_id, nickname) VALUES
    (v_user_a_id::text, 'dev-space-public', 'ほっしー太郎'),
    (v_same_name_id::text, 'dev-space-public', 'ほっしー太郎'),
    (v_user_b_id::text, 'dev-space-public', 'Dev User B'),
    (v_community_admin_id::text, 'dev-space-public', 'Community Admin'),
    (v_user_a_id::text, 'dev-space-my-on', 'Dev User A')
  ON CONFLICT (profile_id, space_id) DO UPDATE SET nickname = EXCLUDED.nickname;

  -- My Hossii space preferences (user A hidden on my-on space)
  INSERT INTO space_my_hossii_preferences (space_id, user_id, is_visible)
  VALUES ('dev-space-my-on', v_user_a_id, false)
  ON CONFLICT (space_id, user_id) DO UPDATE SET is_visible = EXCLUDED.is_visible;

  -- participant accounts (auth users created by seed script)
  IF v_participant_active_id IS NOT NULL THEN
    INSERT INTO space_participant_accounts (
      space_id, slot_number, login_id, auth_user_id, auth_email, status, issued_by
    ) VALUES (
      'dev-space-public', 1, 'public-01', v_participant_active_id,
      'dev-space-public.public-01@participants.internal', 'active', v_community_admin_id
    )
    ON CONFLICT (space_id, slot_number) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      auth_email = EXCLUDED.auth_email,
      status = EXCLUDED.status;
  END IF;

  IF v_participant_revoked_id IS NOT NULL THEN
    INSERT INTO space_participant_accounts (
      space_id, slot_number, login_id, auth_user_id, auth_email, status, issued_by
    ) VALUES (
      'dev-space-public', 2, 'public-02', v_participant_revoked_id,
      'dev-space-public.public-02@participants.internal', 'revoked', v_community_admin_id
    )
    ON CONFLICT (space_id, slot_number) DO UPDATE SET
      auth_user_id = EXCLUDED.auth_user_id,
      auth_email = EXCLUDED.auth_email,
      status = EXCLUDED.status;
  END IF;

  -- fictional posts (15)
  DELETE FROM hossiis WHERE space_id LIKE 'dev-space-%';

  INSERT INTO hossiis (id, message, emotion, space_id, author_id, author_name, origin, created_at) VALUES
    ('dev-post-001', '今日は開発環境のテスト投稿です。', 'joy', 'dev-space-public', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '12 days'),
    ('dev-post-002', '架空の気持ちを共有します。', 'wow', 'dev-space-public', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '10 days'),
    ('dev-post-003', '感情なしメッセージの例です。', NULL, 'dev-space-public', v_community_admin_id::text, 'Community Admin', 'manual', now() - interval '9 days'),
    ('dev-post-004', 'モーション確認用の投稿。', 'fun', 'dev-space-motion', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '8 days'),
    ('dev-post-005', 'ログ公開範囲テスト。', 'empathy', 'dev-space-log-vis', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '7 days'),
    ('dev-post-006', 'My Hossii ON スペース向け。', 'inspire', 'dev-space-my-on', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '6 days'),
    ('dev-post-007', '非公開スペースの投稿。', 'moved', 'dev-space-private', v_community_admin_id::text, 'Community Admin', 'manual', now() - interval '5 days'),
    ('dev-post-008', '古い日時の投稿サンプル。', 'think', 'dev-space-public', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '30 days'),
    ('dev-post-009', '新しい投稿サンプル。', 'laugh', 'dev-space-public', v_same_name_id::text, 'Dev Same Name', 'manual', now() - interval '1 hour'),
    ('dev-post-010', '同名ニックネーム確認用。', 'joy', 'dev-space-public', v_same_name_id::text, 'ほっしー太郎', 'manual', now() - interval '50 minutes'),
    ('dev-post-011', '投稿ゼロユーザー向けスペース外投稿。', 'wow', 'dev-space-my-off', v_community_admin_id::text, 'Community Admin', 'manual', now() - interval '4 days'),
    ('dev-post-012', 'もう一つの架空投稿。', 'fun', 'dev-space-public', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '3 days'),
    ('dev-post-013', '開発用テストデータ。', 'empathy', 'dev-space-motion', v_same_name_id::text, 'Dev Same Name', 'manual', now() - interval '2 days'),
    ('dev-post-014', '最近の投稿。', 'inspire', 'dev-space-log-vis', v_community_admin_id::text, 'Community Admin', 'manual', now() - interval '20 hours'),
    ('dev-post-015', '最後のサンプル投稿。', 'moved', 'dev-space-public', v_user_a_id::text, 'Dev User A', 'manual', now() - interval '15 minutes');
END $$;
