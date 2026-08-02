-- PR-B: choice3 response type
-- - submit_challenge_choice3 RPC (upsert rewrite; visibility frozen on UPDATE)
-- - Snapshots selected option label into challenge_responses.comment
-- - Validates response_config.options is exactly 3 non-empty labels
-- Preconditions: CHECK already includes choice3 (20260803010000).

-- ---------------------------------------------------------------------------
-- submit_challenge_choice3
--   - Requires item.response_type = choice3
--   - p_option_index: 0..2 against response_config.options (exactly 3 strings)
--   - Stores selected label snapshot in comment
--   - INSERT stamps visibility; UPDATE keeps visibility (rewrite allowed)
--   - Completion/reward: first time only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_challenge_choice3(
  p_item_id uuid,
  p_option_index integer
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
  v_options jsonb;
  v_option_count integer;
  v_label text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'item_id is required';
  END IF;

  IF p_option_index IS NULL OR p_option_index < 0 OR p_option_index > 2 THEN
    RAISE EXCEPTION 'option_index must be 0, 1, or 2';
  END IF;

  SELECT * INTO v_item
  FROM public.challenge_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found' USING ERRCODE = '42501';
  END IF;

  IF v_item.response_type IS DISTINCT FROM 'choice3' THEN
    RAISE EXCEPTION 'only choice3 items can be answered here';
  END IF;

  v_options := v_item.response_config -> 'options';
  IF v_options IS NULL OR jsonb_typeof(v_options) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'choice3 options are not configured';
  END IF;

  SELECT count(*)::integer INTO v_option_count
  FROM jsonb_array_elements_text(v_options) AS opt(label)
  WHERE btrim(opt.label) <> '';

  IF v_option_count IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'choice3 requires exactly 3 non-empty options';
  END IF;

  -- Reject whitespace-only or missing slots by checking raw length as well.
  IF jsonb_array_length(v_options) IS DISTINCT FROM 3 THEN
    RAISE EXCEPTION 'choice3 requires exactly 3 options';
  END IF;

  v_label := btrim(v_options ->> p_option_index);
  IF v_label IS NULL OR char_length(v_label) < 1 THEN
    RAISE EXCEPTION 'selected option is empty';
  END IF;
  IF char_length(v_label) > 500 THEN
    RAISE EXCEPTION 'selected option exceeds 500 characters';
  END IF;

  v_comment := v_label;

  SELECT * INTO v_program
  FROM public.challenge_programs
  WHERE id = v_item.program_id;

  IF NOT FOUND OR v_program.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'program is not published' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_active_space_member(v_program.space_id) THEN
    RAISE EXCEPTION 'active membership required' USING ERRCODE = '42501';
  END IF;

  v_visibility := COALESCE(
    v_item.response_visibility,
    v_program.default_response_visibility,
    'manager_only'
  );
  IF v_visibility NOT IN ('self_only', 'manager_only', 'space_members') THEN
    RAISE EXCEPTION 'resolved visibility is invalid';
  END IF;

  -- Atomic upsert. UPDATE (rewrite) changes comment only; visibility stays stamped.
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

REVOKE ALL ON FUNCTION public.submit_challenge_choice3(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_challenge_choice3(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_challenge_choice3(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.submit_challenge_choice3(uuid, integer) IS
  'PR-B: choice3 UPSERT. Snapshots option label into comment. INSERT stamps visibility; UPDATE keeps it. Completion/reward once.';
