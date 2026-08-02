-- PR-A: complete_button response type
-- - Rename response_type CHECK values to product names
-- - Add challenge_items.response_config (jsonb) for future choice3 / button settings
-- - Add submit_challenge_complete_button RPC (idempotent; no rewrite)
-- Preconditions: no rows use legacy 'completion' / 'single_choice' (asserted below).

-- ---------------------------------------------------------------------------
-- 0. Safety: refuse if legacy response_type values exist
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_legacy integer;
BEGIN
  SELECT count(*)::integer INTO v_legacy
  FROM public.challenge_items
  WHERE response_type IN ('completion', 'single_choice');

  IF v_legacy > 0 THEN
    RAISE EXCEPTION
      'cannot rename response_type CHECK: % row(s) still use completion/single_choice',
      v_legacy;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. response_type CHECK → comment / complete_button / choice3 / photo
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_items
  DROP CONSTRAINT IF EXISTS challenge_items_response_type_check;

ALTER TABLE public.challenge_items
  ADD CONSTRAINT challenge_items_response_type_check
    CHECK (response_type IN ('comment', 'complete_button', 'choice3', 'photo'));

COMMENT ON COLUMN public.challenge_items.response_type IS
  'comment | complete_button | choice3 | photo';

-- ---------------------------------------------------------------------------
-- 2. response_config (nullable jsonb) for type-specific item settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_items
  ADD COLUMN IF NOT EXISTS response_config jsonb NULL;

COMMENT ON COLUMN public.challenge_items.response_config IS
  'Type-specific settings. complete_button: unused/{} for now. choice3: {"options":[...]} (PR-B).';

-- ---------------------------------------------------------------------------
-- 3. submit_challenge_complete_button
--    - Requires item.response_type = complete_button
--    - Stores fixed display comment 「完了しました」
--    - Stamps visibility from item → program on INSERT
--    - Existing response: no-op (no rewrite / no duplicate)
--    - Completion/reward: first time only (same invariants as comment RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_challenge_complete_button(
  p_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_comment text := '完了しました';
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

  SELECT * INTO v_item
  FROM public.challenge_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found' USING ERRCODE = '42501';
  END IF;

  IF v_item.response_type IS DISTINCT FROM 'complete_button' THEN
    RAISE EXCEPTION 'only complete_button items can be answered here';
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

  v_visibility := COALESCE(
    v_item.response_visibility,
    v_program.default_response_visibility,
    'manager_only'
  );
  IF v_visibility NOT IN ('self_only', 'manager_only', 'space_members') THEN
    RAISE EXCEPTION 'resolved visibility is invalid';
  END IF;

  -- Insert only. Existing response is left unchanged (no rewrite).
  INSERT INTO public.challenge_responses (item_id, user_id, visibility, comment)
  VALUES (p_item_id, v_uid, v_visibility, v_comment)
  ON CONFLICT (item_id, user_id) DO NOTHING
  RETURNING * INTO v_response;

  IF FOUND THEN
    v_was_insert := true;
  ELSE
    SELECT * INTO v_response
    FROM public.challenge_responses
    WHERE item_id = p_item_id
      AND user_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'failed to load challenge response';
    END IF;
    v_was_insert := false;
  END IF;

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

REVOKE ALL ON FUNCTION public.submit_challenge_complete_button(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_challenge_complete_button(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_challenge_complete_button(uuid) TO authenticated;

COMMENT ON FUNCTION public.submit_challenge_complete_button(uuid) IS
  'PR-A: complete_button insert-or-return. Stamps visibility on INSERT. No rewrite. Completion/reward once.';
