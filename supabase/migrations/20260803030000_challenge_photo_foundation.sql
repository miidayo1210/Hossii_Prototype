-- PR-C foundation: challenge photo response type (Storage + DB + RPC)
-- - Private bucket challenge-photos (not hossii-images)
-- - challenge_responses.photo_path
-- - Path: challenge/{spaceId}/{itemId}/{userId}/{uuid}.jpg
-- - Storage RLS mirrors response visibility
-- - submit_challenge_photo RPC (UPSERT rewrite; visibility freeze)
-- UI is out of scope for this migration.

-- ---------------------------------------------------------------------------
-- 0. Private bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'challenge-photos',
  'challenge-photos',
  false,
  5242880, -- 5 MiB
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 1. photo_path on challenge_responses
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_responses
  ADD COLUMN IF NOT EXISTS photo_path text NULL;

COMMENT ON COLUMN public.challenge_responses.photo_path IS
  'Storage object path in challenge-photos bucket. photo items only; null for other types.';

CREATE INDEX IF NOT EXISTS challenge_responses_photo_path_idx
  ON public.challenge_responses (photo_path)
  WHERE photo_path IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Helpers: path ownership + SELECT authorization (mirrors response RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_challenge_photo_owner_path(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    p_object_name IS NOT NULL
    AND (storage.foldername(p_object_name))[1] = 'challenge'
    AND (storage.foldername(p_object_name))[4] = auth.uid()::text;
$$;

REVOKE ALL ON FUNCTION public.is_challenge_photo_owner_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_challenge_photo_owner_path(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_select_challenge_photo_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      -- Owner may read own folder objects (including pre-RPC upload / cleanup).
      public.is_challenge_photo_owner_path(p_object_name)
      OR EXISTS (
        SELECT 1
        FROM public.challenge_responses r
        JOIN public.challenge_items i ON i.id = r.item_id
        JOIN public.challenge_programs p ON p.id = i.program_id
        WHERE r.photo_path = p_object_name
          AND (
            r.user_id = auth.uid()
            OR (
              r.visibility = 'manager_only'
              AND public.is_space_community_admin(p.space_id)
            )
            OR (
              r.visibility = 'space_members'
              AND (
                public.is_active_space_member(p.space_id)
                OR public.is_space_community_admin(p.space_id)
              )
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_select_challenge_photo_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_select_challenge_photo_object(text) TO authenticated;

COMMENT ON FUNCTION public.can_select_challenge_photo_object(text) IS
  'Storage SELECT / signed URL gate for challenge-photos. Mirrors challenge_responses visibility RLS; never cross-space.';

-- ---------------------------------------------------------------------------
-- 3. Storage RLS on challenge-photos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "challenge_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "challenge_photos_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "challenge_photos_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "challenge_photos_delete_owner" ON storage.objects;

CREATE POLICY "challenge_photos_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND public.can_select_challenge_photo_object(name)
  );

CREATE POLICY "challenge_photos_insert_owner"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'challenge-photos'
    AND (storage.foldername(name))[1] = 'challenge'
    AND (storage.foldername(name))[4] = auth.uid()::text
    AND public.is_active_space_member((storage.foldername(name))[2])
  );

CREATE POLICY "challenge_photos_update_owner"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND public.is_challenge_photo_owner_path(name)
  )
  WITH CHECK (
    bucket_id = 'challenge-photos'
    AND public.is_challenge_photo_owner_path(name)
  );

CREATE POLICY "challenge_photos_delete_owner"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'challenge-photos'
    AND public.is_challenge_photo_owner_path(name)
  );

-- ---------------------------------------------------------------------------
-- 4. submit_challenge_photo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_challenge_photo(
  p_item_id uuid,
  p_photo_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comment text := '写真';
  v_visibility text;
  v_item public.challenge_items%ROWTYPE;
  v_program public.challenge_programs%ROWTYPE;
  v_response public.challenge_responses%ROWTYPE;
  v_completion public.challenge_completions%ROWTYPE;
  v_reward public.challenge_rewards%ROWTYPE;
  v_is_new_reward boolean := false;
  v_pool text[];
  v_key text;
  v_was_insert boolean := false;
  v_path text;
  v_expected_prefix text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'item_id is required';
  END IF;

  v_path := btrim(COALESCE(p_photo_path, ''));
  IF v_path = '' THEN
    RAISE EXCEPTION 'photo_path is required';
  END IF;

  SELECT * INTO v_item
  FROM public.challenge_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found' USING ERRCODE = '42501';
  END IF;

  IF v_item.response_type IS DISTINCT FROM 'photo' THEN
    RAISE EXCEPTION 'only photo items can be answered here';
  END IF;

  SELECT * INTO v_program
  FROM public.challenge_programs
  WHERE id = v_item.program_id;

  IF NOT FOUND OR v_program.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'program is not published' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_active_space_member(v_program.space_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  v_expected_prefix :=
    'challenge/' || v_program.space_id || '/' || p_item_id::text || '/' || v_uid::text || '/';

  IF position('..' in v_path) > 0 OR position('//' in v_path) > 0 THEN
    RAISE EXCEPTION 'photo_path is invalid';
  END IF;

  IF left(v_path, char_length(v_expected_prefix)) IS DISTINCT FROM v_expected_prefix THEN
    RAISE EXCEPTION 'photo_path prefix mismatch';
  END IF;

  IF substring(v_path from char_length(v_expected_prefix) + 1) !~
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$'
  THEN
    RAISE EXCEPTION 'photo_path must be challenge/{spaceId}/{itemId}/{userId}/{uuid}.jpg';
  END IF;

  -- Object must already exist in the private bucket (client uploaded first).
  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = 'challenge-photos'
      AND o.name = v_path
  ) THEN
    RAISE EXCEPTION 'photo object not found in storage';
  END IF;

  v_visibility := COALESCE(
    v_item.response_visibility,
    v_program.default_response_visibility,
    'manager_only'
  );
  IF v_visibility NOT IN ('self_only', 'manager_only', 'space_members') THEN
    RAISE EXCEPTION 'resolved visibility is invalid';
  END IF;

  INSERT INTO public.challenge_responses (
    item_id, user_id, visibility, comment, photo_path
  )
  VALUES (p_item_id, v_uid, v_visibility, v_comment, v_path)
  ON CONFLICT (item_id, user_id) DO UPDATE
    SET
      comment = EXCLUDED.comment,
      photo_path = EXCLUDED.photo_path
  RETURNING
    id,
    item_id,
    user_id,
    visibility,
    comment,
    photo_path,
    created_at,
    updated_at,
    (xmax = 0)
  INTO
    v_response.id,
    v_response.item_id,
    v_response.user_id,
    v_response.visibility,
    v_response.comment,
    v_response.photo_path,
    v_response.created_at,
    v_response.updated_at,
    v_was_insert;

  INSERT INTO public.challenge_completions (item_id, user_id, response_id)
  VALUES (p_item_id, v_uid, v_response.id)
  ON CONFLICT (item_id, user_id) DO UPDATE
    SET response_id = EXCLUDED.response_id
  RETURNING * INTO v_completion;

  SELECT * INTO v_reward
  FROM public.challenge_rewards
  WHERE completion_id = v_completion.id;

  IF NOT FOUND THEN
    v_pool := public.challenge_reward_hossii_pool();

    SELECT k INTO v_key
    FROM unnest(v_pool) AS k
    WHERE k NOT IN (
      SELECT r.hossii_key
      FROM public.challenge_rewards r
      WHERE r.user_id = v_uid
    )
    ORDER BY random()
    LIMIT 1;

    IF v_key IS NULL THEN
      SELECT k INTO v_key
      FROM unnest(v_pool) AS k
      ORDER BY random()
      LIMIT 1;
    END IF;

    INSERT INTO public.challenge_rewards (
      completion_id, user_id, item_id, hossii_key
    )
    VALUES (v_completion.id, v_uid, p_item_id, v_key)
    ON CONFLICT (completion_id) DO NOTHING
    RETURNING * INTO v_reward;

    IF FOUND THEN
      v_is_new_reward := true;
    ELSE
      SELECT * INTO v_reward
      FROM public.challenge_rewards
      WHERE completion_id = v_completion.id;
      v_is_new_reward := false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'response', jsonb_build_object(
      'id', v_response.id,
      'item_id', v_response.item_id,
      'user_id', v_response.user_id,
      'visibility', v_response.visibility,
      'comment', v_response.comment,
      'photo_path', v_response.photo_path,
      'created_at', v_response.created_at,
      'updated_at', v_response.updated_at
    ),
    'completion', jsonb_build_object(
      'id', v_completion.id,
      'item_id', v_completion.item_id,
      'user_id', v_completion.user_id,
      'response_id', v_completion.response_id,
      'completed_at', v_completion.completed_at,
      'created_at', v_completion.created_at
    ),
    'reward', jsonb_build_object(
      'id', v_reward.id,
      'completion_id', v_reward.completion_id,
      'user_id', v_reward.user_id,
      'item_id', v_reward.item_id,
      'hossii_key', v_reward.hossii_key,
      'awarded_at', v_reward.awarded_at,
      'created_at', v_reward.created_at
    ),
    'is_new_reward', v_is_new_reward,
    'was_insert', v_was_insert
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_challenge_photo(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_challenge_photo(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_challenge_photo(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.submit_challenge_photo(uuid, text) IS
  'PR-C: photo UPSERT. comment fixed 写真. photo_path validated. INSERT stamps visibility; UPDATE keeps it. Completion/reward once.';
