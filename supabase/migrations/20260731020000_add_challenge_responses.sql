-- Stage 3 / P4: challenge_responses + participant read of published programs/items
-- Answer source of truth is challenge_responses (not hossiis).
-- Visibility MVP: self_only | manager_only. Physical DELETE by owner only (no rewards yet).

-- ---------------------------------------------------------------------------
-- 1. challenge_responses
-- ---------------------------------------------------------------------------
CREATE TABLE public.challenge_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL
                REFERENCES public.challenge_items(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL DEFAULT auth.uid()
                REFERENCES auth.users(id) ON DELETE RESTRICT,
  visibility  text NOT NULL DEFAULT 'manager_only',
  comment     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_responses_visibility_check
    CHECK (visibility IN ('self_only', 'manager_only')),
  CONSTRAINT challenge_responses_comment_length
    CHECK (char_length(btrim(comment)) BETWEEN 1 AND 500),
  CONSTRAINT challenge_responses_item_user_unique
    UNIQUE (item_id, user_id)
);

CREATE INDEX challenge_responses_item_id_idx
  ON public.challenge_responses (item_id);

CREATE INDEX challenge_responses_user_id_idx
  ON public.challenge_responses (user_id);

COMMENT ON TABLE public.challenge_responses IS
  '挑戦状コメント回答の正本。通常投稿（hossiis）へは保存しない。';

COMMENT ON COLUMN public.challenge_responses.visibility IS
  'self_only（本人のみ）| manager_only（本人＋スペース管理者）。初期値 manager_only。';

-- ---------------------------------------------------------------------------
-- 2. updated_at + user_id guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_responses_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_responses_set_updated_at
  BEFORE UPDATE ON public.challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.challenge_responses_set_updated_at();

CREATE OR REPLACE FUNCTION public.challenge_responses_guard_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'challenge_responses insert requires authenticated user';
    END IF;
    NEW.user_id := auth.uid();
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;
  IF NEW.item_id IS DISTINCT FROM OLD.item_id THEN
    NEW.item_id := OLD.item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_responses_guard_user_id
  BEFORE INSERT OR UPDATE ON public.challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.challenge_responses_guard_user_id();

REVOKE ALL ON FUNCTION public.challenge_responses_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.challenge_responses_guard_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.challenge_responses_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_responses_guard_user_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Participant SELECT on published (ended/archived readable) programs/items
--    P1 was admin-only; additive policies (OR) for active members.
-- ---------------------------------------------------------------------------
CREATE POLICY "challenge_programs_select_member_visible"
  ON public.challenge_programs
  FOR SELECT
  TO authenticated
  USING (
    status IN ('published', 'ended', 'archived')
    AND public.is_active_space_member(space_id)
  );

CREATE POLICY "challenge_items_select_member_visible"
  ON public.challenge_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND p.status IN ('published', 'ended', 'archived')
        AND public.is_active_space_member(p.space_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. challenge_responses RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_responses_select_owner_or_manager"
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
  );

CREATE POLICY "challenge_responses_insert_member_published_comment"
  ON public.challenge_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND visibility IN ('self_only', 'manager_only')
    AND EXISTS (
      SELECT 1
      FROM public.challenge_items i
      JOIN public.challenge_programs p ON p.id = i.program_id
      WHERE i.id = challenge_responses.item_id
        AND i.response_type = 'comment'
        AND p.status = 'published'
        AND public.is_active_space_member(p.space_id)
    )
  );

CREATE POLICY "challenge_responses_update_owner_active"
  ON public.challenge_responses
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.challenge_items i
      JOIN public.challenge_programs p ON p.id = i.program_id
      WHERE i.id = challenge_responses.item_id
        AND p.status IN ('published', 'ended')
        AND public.is_active_space_member(p.space_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND visibility IN ('self_only', 'manager_only')
    AND EXISTS (
      SELECT 1
      FROM public.challenge_items i
      JOIN public.challenge_programs p ON p.id = i.program_id
      WHERE i.id = challenge_responses.item_id
        AND p.status IN ('published', 'ended')
        AND public.is_active_space_member(p.space_id)
    )
  );

CREATE POLICY "challenge_responses_delete_owner"
  ON public.challenge_responses
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. grants（anon には付与しない）
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_responses TO authenticated;
