-- Challenge response visibility Phase 2 foundation.
-- - program default + optional item override
-- - stamp visibility on INSERT only; preserve on UPDATE (rewrite)
-- - expand CHECK + RLS for space_members
-- - client p_visibility kept for signature compat but ignored
-- Does NOT UPDATE existing challenge_responses rows.

-- ---------------------------------------------------------------------------
-- 1. program default / item override columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_programs
  ADD COLUMN IF NOT EXISTS default_response_visibility text NOT NULL DEFAULT 'manager_only';

ALTER TABLE public.challenge_programs
  DROP CONSTRAINT IF EXISTS challenge_programs_default_response_visibility_check;

ALTER TABLE public.challenge_programs
  ADD CONSTRAINT challenge_programs_default_response_visibility_check
  CHECK (
    default_response_visibility IN (
      'space_members',
      'manager_only',
      'self_only'
    )
  );

COMMENT ON COLUMN public.challenge_programs.default_response_visibility IS
  'プログラム標準の回答公開範囲。space_members | manager_only | self_only。初期値 manager_only。';

ALTER TABLE public.challenge_items
  ADD COLUMN IF NOT EXISTS response_visibility text;

ALTER TABLE public.challenge_items
  DROP CONSTRAINT IF EXISTS challenge_items_response_visibility_check;

ALTER TABLE public.challenge_items
  ADD CONSTRAINT challenge_items_response_visibility_check
  CHECK (
    response_visibility IS NULL
    OR response_visibility IN (
      'space_members',
      'manager_only',
      'self_only'
    )
  );

COMMENT ON COLUMN public.challenge_items.response_visibility IS
  '項目の公開範囲上書き。NULL のとき program.default_response_visibility を継承。';

-- ---------------------------------------------------------------------------
-- 2. Expand challenge_responses.visibility CHECK (no row backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_responses
  DROP CONSTRAINT IF EXISTS challenge_responses_visibility_check;

ALTER TABLE public.challenge_responses
  ADD CONSTRAINT challenge_responses_visibility_check
  CHECK (
    visibility IN (
      'self_only',
      'manager_only',
      'space_members'
    )
  );

COMMENT ON COLUMN public.challenge_responses.visibility IS
  '回答時点の公開範囲スナップショット。self_only | manager_only | space_members。再回答では変更しない。';

-- ---------------------------------------------------------------------------
-- 3. SELECT RLS by stamped visibility
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "challenge_responses_select_owner_or_manager"
  ON public.challenge_responses;

DROP POLICY IF EXISTS "challenge_responses_select_by_visibility"
  ON public.challenge_responses;

CREATE POLICY "challenge_responses_select_by_visibility"
  ON public.challenge_responses
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      visibility = 'manager_only'
      AND EXISTS (
        SELECT 1
        FROM public.challenge_items i
        JOIN public.challenge_programs p ON p.id = i.program_id
        WHERE i.id = challenge_responses.item_id
          AND public.is_space_community_admin(p.space_id)
      )
    )
    OR (
      visibility = 'space_members'
      AND EXISTS (
        SELECT 1
        FROM public.challenge_items i
        JOIN public.challenge_programs p ON p.id = i.program_id
        WHERE i.id = challenge_responses.item_id
          AND (
            public.is_active_space_member(p.space_id)
            OR public.is_space_community_admin(p.space_id)
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. submit_challenge_comment_response — resolve on INSERT, freeze on UPDATE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_challenge_comment_response(
  p_item_id uuid,
  p_comment text,
  p_visibility text DEFAULT 'manager_only'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comment text;
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'item_id is required';
  END IF;

  -- p_visibility is accepted for client signature compatibility but ignored
  -- (visibility is resolved from item/program on INSERT only).

  v_comment := btrim(COALESCE(p_comment, ''));
  IF char_length(v_comment) < 1 OR char_length(v_comment) > 500 THEN
    RAISE EXCEPTION 'comment must be 1 to 500 characters';
  END IF;

  SELECT * INTO v_item
  FROM public.challenge_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found' USING ERRCODE = '42501';
  END IF;

  IF v_item.response_type IS DISTINCT FROM 'comment' THEN
    RAISE EXCEPTION 'only comment items can be answered here';
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

  -- Resolve stamp for new rows only: item override → program default.
  v_visibility := COALESCE(
    v_item.response_visibility,
    v_program.default_response_visibility,
    'manager_only'
  );
  IF v_visibility NOT IN ('self_only', 'manager_only', 'space_members') THEN
    RAISE EXCEPTION 'resolved visibility is invalid';
  END IF;

  -- Atomic upsert on UNIQUE (item_id, user_id).
  -- UPDATE (rewrite) changes comment only; visibility stays as originally stamped.
  -- After DELETE + new INSERT, a fresh stamp from current settings is applied.
  -- xmax = 0 means this statement inserted the row (not an update).
  INSERT INTO public.challenge_responses (item_id, user_id, visibility, comment)
  VALUES (p_item_id, v_uid, v_visibility, v_comment)
  ON CONFLICT (item_id, user_id) DO UPDATE
    SET comment = EXCLUDED.comment
  RETURNING
    id,
    item_id,
    user_id,
    visibility,
    comment,
    created_at,
    updated_at,
    (xmax = 0)
  INTO
    v_response.id,
    v_response.item_id,
    v_response.user_id,
    v_response.visibility,
    v_response.comment,
    v_response.created_at,
    v_response.updated_at,
    v_was_insert;

  -- Completion: one per (item,user). Re-link response_id (e.g. after answer delete).
  -- Do not touch completed_at on conflict (first achievement time is preserved).
  INSERT INTO public.challenge_completions (item_id, user_id, response_id)
  VALUES (p_item_id, v_uid, v_response.id)
  ON CONFLICT (item_id, user_id) DO UPDATE
    SET response_id = EXCLUDED.response_id
  RETURNING * INTO v_completion;

  -- Reward: at most one per completion. Client cannot choose hossii_key.
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

REVOKE ALL ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.submit_challenge_comment_response(uuid, text, text) IS
  'Phase2+: comment UPSERT. INSERT stamps visibility from item/program; UPDATE keeps visibility. p_visibility ignored. Concurrent-safe.';
