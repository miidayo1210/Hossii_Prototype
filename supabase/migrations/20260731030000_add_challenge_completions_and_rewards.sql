-- Stage 4 / P5: challenge_completions + challenge_rewards + atomic submit RPC
-- Answer delete keeps completion/reward (response_id ON DELETE SET NULL).
-- Direct INSERT/UPDATE/DELETE on completions/rewards is not granted to clients;
-- writes go through submit_challenge_comment_response only.
-- Physical DELETE of responses remains allowed; rewards are kept (no soft-delete yet).

-- ---------------------------------------------------------------------------
-- 1. challenge_completions
-- ---------------------------------------------------------------------------
CREATE TABLE public.challenge_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL
                 REFERENCES public.challenge_items(id) ON DELETE RESTRICT,
  user_id      uuid NOT NULL
                 REFERENCES auth.users(id) ON DELETE RESTRICT,
  response_id  uuid
                 REFERENCES public.challenge_responses(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_completions_item_user_unique UNIQUE (item_id, user_id)
);

CREATE INDEX challenge_completions_user_id_idx
  ON public.challenge_completions (user_id);

COMMENT ON TABLE public.challenge_completions IS
  '挑戦状項目の達成記録。回答削除後も保持する。';

COMMENT ON COLUMN public.challenge_completions.response_id IS
  '根拠回答。回答物理DELETE時は SET NULL。completion/reward は残す。';

-- ---------------------------------------------------------------------------
-- 2. challenge_rewards
-- ---------------------------------------------------------------------------
CREATE TABLE public.challenge_rewards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id uuid NOT NULL
                  REFERENCES public.challenge_completions(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL
                  REFERENCES auth.users(id) ON DELETE RESTRICT,
  item_id       uuid NOT NULL
                  REFERENCES public.challenge_items(id) ON DELETE RESTRICT,
  hossii_key    text NOT NULL,
  awarded_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_rewards_completion_unique UNIQUE (completion_id),
  CONSTRAINT challenge_rewards_hossii_key_length
    CHECK (char_length(hossii_key) BETWEEN 1 AND 100)
);

CREATE INDEX challenge_rewards_user_id_idx
  ON public.challenge_rewards (user_id);

CREATE INDEX challenge_rewards_user_item_idx
  ON public.challenge_rewards (user_id, item_id);

COMMENT ON TABLE public.challenge_rewards IS
  '達成時に付与されたHossii報酬の正本。hossii_key は安定キー（画像パスではない）。';

-- ---------------------------------------------------------------------------
-- 3. RLS — SELECT own only; no direct writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_completions_select_own"
  ON public.challenge_completions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "challenge_rewards_select_own"
  ON public.challenge_rewards
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.challenge_completions TO authenticated;
GRANT SELECT ON public.challenge_rewards TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Hossii key pool (stable keys → /hossii/{key}.png)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_reward_hossii_pool()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'emotion/wow',
    'emotion/happy',
    'emotion/heart',
    'emotion/comeup',
    'emotion/humhum',
    'emotion/cryinglaughing',
    'emotion/moved',
    'emotion/fun',
    'emotion/kirakira',
    'emotion/yeah',
    'idle/idle_smile',
    'motion/cheering'
  ]::text[];
$$;

REVOKE ALL ON FUNCTION public.challenge_reward_hossii_pool() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.challenge_reward_hossii_pool() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. submit_challenge_comment_response (SECURITY DEFINER, atomic)
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

  v_comment := btrim(COALESCE(p_comment, ''));
  IF char_length(v_comment) < 1 OR char_length(v_comment) > 500 THEN
    RAISE EXCEPTION 'comment must be 1 to 500 characters';
  END IF;

  v_visibility := COALESCE(p_visibility, 'manager_only');
  IF v_visibility NOT IN ('self_only', 'manager_only') THEN
    RAISE EXCEPTION 'visibility must be self_only or manager_only';
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

  -- Upsert response (unique item_id,user_id)
  SELECT * INTO v_response
  FROM public.challenge_responses
  WHERE item_id = p_item_id AND user_id = v_uid;

  IF FOUND THEN
    UPDATE public.challenge_responses
    SET comment = v_comment,
        visibility = v_visibility
    WHERE id = v_response.id
    RETURNING * INTO v_response;
  ELSE
    INSERT INTO public.challenge_responses (item_id, user_id, visibility, comment)
    VALUES (p_item_id, v_uid, v_visibility, v_comment)
    RETURNING * INTO v_response;
    v_was_insert := true;
  END IF;

  -- Completion: one per (item,user). Refresh response_id link.
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
  'P5: comment response upsert + completion + one-time Hossii reward. No client user_id/hossii_key.';
