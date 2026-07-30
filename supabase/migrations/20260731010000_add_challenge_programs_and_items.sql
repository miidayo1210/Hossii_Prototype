-- Stage 1: challenge_programs / challenge_items DB foundation
-- Admin-only CRUD via RLS. No participant access. No RPC.
-- Physical DELETE only when program.status = 'draft'.

-- ---------------------------------------------------------------------------
-- 1. challenge_programs
-- ---------------------------------------------------------------------------
CREATE TABLE public.challenge_programs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    text NOT NULL
                REFERENCES public.spaces(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'draft',
  created_by  uuid DEFAULT auth.uid()
                REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_programs_title_length
    CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT challenge_programs_status_check
    CHECK (status IN ('draft', 'published', 'ended', 'archived'))
);

CREATE INDEX challenge_programs_space_id_idx
  ON public.challenge_programs (space_id);

CREATE INDEX challenge_programs_space_status_idx
  ON public.challenge_programs (space_id, status);

COMMENT ON TABLE public.challenge_programs IS
  '挑戦状ストーリー（challenge program）。回答・報酬の親となる正本。';

COMMENT ON COLUMN public.challenge_programs.status IS
  'draft | published | ended | archived。物理DELETEは draft のみ。';

-- ---------------------------------------------------------------------------
-- 2. challenge_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.challenge_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL
                  REFERENCES public.challenge_programs(id) ON DELETE CASCADE,
  item_type     text NOT NULL DEFAULT 'question',
  title         text NOT NULL,
  description   text,
  reason        text,
  response_type text NOT NULL DEFAULT 'comment',
  is_required   boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_items_title_length
    CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT challenge_items_item_type_check
    CHECK (item_type IN ('question', 'mission')),
  CONSTRAINT challenge_items_response_type_check
    CHECK (response_type IN ('comment', 'photo', 'single_choice', 'completion')),
  CONSTRAINT challenge_items_sort_order_nonnegative
    CHECK (sort_order >= 0)
);

CREATE INDEX challenge_items_program_sort_idx
  ON public.challenge_items (program_id, sort_order);

COMMENT ON TABLE public.challenge_items IS
  '挑戦状項目（question / mission）。space_id は持たず program 経由で権限判定する。';

COMMENT ON COLUMN public.challenge_items.item_type IS
  'question | mission';

COMMENT ON COLUMN public.challenge_items.response_type IS
  'comment | photo | single_choice | completion';

-- ---------------------------------------------------------------------------
-- 3. updated_at triggers（テーブル単位。search_path を固定）
--    共通 update_updated_at_column は search_path 未固定の古い定義のため再利用しない。
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_programs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_programs_set_updated_at
  BEFORE UPDATE ON public.challenge_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.challenge_programs_set_updated_at();

CREATE OR REPLACE FUNCTION public.challenge_items_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_items_set_updated_at
  BEFORE UPDATE ON public.challenge_items
  FOR EACH ROW
  EXECUTE FUNCTION public.challenge_items_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. created_by 正本（INSERT 時は auth.uid() 固定。UPDATE で変更不可）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_programs_guard_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'challenge_programs insert requires authenticated user';
    END IF;
    NEW.created_by := auth.uid();
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER challenge_programs_guard_created_by
  BEFORE INSERT OR UPDATE ON public.challenge_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.challenge_programs_guard_created_by();

-- ---------------------------------------------------------------------------
-- 5. RLS — challenge_programs
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_programs_select_admin"
  ON public.challenge_programs
  FOR SELECT
  TO authenticated
  USING (public.is_space_community_admin(space_id));

CREATE POLICY "challenge_programs_insert_admin"
  ON public.challenge_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_space_community_admin(space_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "challenge_programs_update_admin"
  ON public.challenge_programs
  FOR UPDATE
  TO authenticated
  USING (public.is_space_community_admin(space_id))
  WITH CHECK (public.is_space_community_admin(space_id));

CREATE POLICY "challenge_programs_delete_admin_draft"
  ON public.challenge_programs
  FOR DELETE
  TO authenticated
  USING (
    public.is_space_community_admin(space_id)
    AND status = 'draft'
  );

-- ---------------------------------------------------------------------------
-- 6. RLS — challenge_items（space_id は持たず program 経由）
--    item UPDATE は Stage 1 では draft 親のみ（案A）。
--    公開後の軽微文言修正は後続 migration / RPC で許可する。
-- ---------------------------------------------------------------------------
ALTER TABLE public.challenge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_items_select_admin"
  ON public.challenge_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND public.is_space_community_admin(p.space_id)
    )
  );

CREATE POLICY "challenge_items_insert_admin_draft"
  ON public.challenge_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND p.status = 'draft'
        AND public.is_space_community_admin(p.space_id)
    )
  );

CREATE POLICY "challenge_items_update_admin_draft"
  ON public.challenge_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND p.status = 'draft'
        AND public.is_space_community_admin(p.space_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND p.status = 'draft'
        AND public.is_space_community_admin(p.space_id)
    )
  );

CREATE POLICY "challenge_items_delete_admin_draft"
  ON public.challenge_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.challenge_programs p
      WHERE p.id = challenge_items.program_id
        AND p.status = 'draft'
        AND public.is_space_community_admin(p.space_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 7. grants（anon には付与しない。参加者 SELECT policy も作らない）
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_programs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_items TO authenticated;
