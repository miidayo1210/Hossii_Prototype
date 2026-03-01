-- hossiitest@gmail.com が app_metadata.role = 'admin' で直接登録されており
-- communities テーブルにエントリがない場合、コミュニティを作成して既存スペースを紐付ける

DO $$
DECLARE
  v_user_id   uuid;
  v_community_id uuid;
BEGIN
  -- hossiitest@gmail.com の auth.users ID を取得
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'hossiitest@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'hossiitest@gmail.com not found in auth.users, skipping.';
    RETURN;
  END IF;

  -- 既にコミュニティがあればスキップ
  SELECT id INTO v_community_id
  FROM communities
  WHERE admin_id = v_user_id
  LIMIT 1;

  IF v_community_id IS NULL THEN
    -- コミュニティを approved 状態で作成
    INSERT INTO communities (admin_id, name, status)
    VALUES (v_user_id, 'Hossii テスト', 'approved')
    RETURNING id INTO v_community_id;

    RAISE NOTICE 'Created community % for hossiitest@gmail.com', v_community_id;
  ELSE
    RAISE NOTICE 'Community % already exists for hossiitest@gmail.com', v_community_id;
  END IF;

  -- community_id が NULL のスペースをこのコミュニティに紐付け
  UPDATE spaces
  SET community_id = v_community_id
  WHERE community_id IS NULL;

  RAISE NOTICE 'Updated spaces with NULL community_id to %', v_community_id;
END $$;
