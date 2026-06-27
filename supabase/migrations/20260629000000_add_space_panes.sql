-- Phase 1: space_panes table, hossiis.space_pane_id, default pane guarantee, RLS, triggers

-- ---------------------------------------------------------------------------
-- space_panes table
-- ---------------------------------------------------------------------------

CREATE TABLE public.space_panes (
  id                      text PRIMARY KEY,
  space_id                text NOT NULL
                            REFERENCES public.spaces(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  slug                    text NOT NULL,
  sort_order              integer NOT NULL DEFAULT 0,
  is_default              boolean NOT NULL DEFAULT false,
  is_visible              boolean NOT NULL DEFAULT true,
  background              jsonb,
  saved_background_images jsonb,
  decorations             jsonb,
  character_image_url     text,
  character_name          text,
  custom_emotions         jsonb,
  bubble_shape_png        text,
  settings                jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, slug),
  CONSTRAINT space_panes_default_must_be_visible
    CHECK (NOT is_default OR is_visible),
  CONSTRAINT space_panes_name_length
    CHECK (char_length(name) BETWEEN 1 AND 30),
  CONSTRAINT space_panes_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT space_panes_default_no_overrides
    CHECK (
      NOT is_default
      OR (
        background IS NULL
        AND saved_background_images IS NULL
        AND decorations IS NULL
        AND character_image_url IS NULL
        AND character_name IS NULL
        AND custom_emotions IS NULL
        AND bubble_shape_png IS NULL
        AND settings IS NULL
      )
    )
);

CREATE UNIQUE INDEX space_panes_one_default_per_space
  ON public.space_panes (space_id)
  WHERE is_default = true;

CREATE INDEX space_panes_space_sort
  ON public.space_panes (space_id, sort_order);

-- ---------------------------------------------------------------------------
-- Trigger functions: pane limits and default pane protection
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_space_pane_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  pane_count integer;
BEGIN
  PERFORM 1 FROM public.spaces WHERE id = NEW.space_id FOR UPDATE;

  SELECT COUNT(*) INTO pane_count
  FROM public.space_panes
  WHERE space_id = NEW.space_id;

  IF pane_count >= 20 THEN
    RAISE EXCEPTION 'space % has reached the maximum of 20 panes', NEW.space_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_default_space_pane()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_default THEN
    IF OLD.is_default IS DISTINCT FROM NEW.is_default THEN
      RAISE EXCEPTION 'cannot change is_default on default pane';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.forbid_default_pane_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'cannot delete default pane';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER space_panes_enforce_limit
  BEFORE INSERT ON public.space_panes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_space_pane_limit();

CREATE TRIGGER space_panes_protect_default
  BEFORE UPDATE ON public.space_panes
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_default_space_pane();

CREATE TRIGGER space_panes_forbid_default_delete
  BEFORE DELETE ON public.space_panes
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_default_pane_delete();

-- ---------------------------------------------------------------------------
-- Default pane on new spaces (SECURITY DEFINER — anon spaces INSERT compatible)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.insert_default_space_pane()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_panes (
    id,
    space_id,
    name,
    slug,
    sort_order,
    is_default,
    is_visible
  ) VALUES (
    NEW.id || '-pane-default',
    NEW.id,
    'メイン',
    'main',
    0,
    true,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_default_space_pane() FROM PUBLIC;

CREATE TRIGGER spaces_insert_default_pane
  AFTER INSERT ON public.spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.insert_default_space_pane();

-- ---------------------------------------------------------------------------
-- Backfill default panes for existing spaces (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.space_panes (
  id,
  space_id,
  name,
  slug,
  sort_order,
  is_default,
  is_visible
)
SELECT
  s.id || '-pane-default',
  s.id,
  'メイン',
  'main',
  0,
  true,
  true
FROM public.spaces s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.space_panes p
  WHERE p.space_id = s.id
    AND p.is_default = true
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- hossiis.space_pane_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.hossiis
  ADD COLUMN IF NOT EXISTS space_pane_id text
  REFERENCES public.space_panes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hossiis_space_pane_created
  ON public.hossiis (space_id, space_pane_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.assert_hossii_pane_space_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.space_pane_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.space_panes p
      WHERE p.id = NEW.space_pane_id
        AND p.space_id = NEW.space_id
    ) THEN
      RAISE EXCEPTION 'space_pane_id does not belong to space_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hossiis_assert_pane_space_match
  BEFORE INSERT OR UPDATE OF space_id, space_pane_id ON public.hossiis
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_hossii_pane_space_match();

-- ---------------------------------------------------------------------------
-- RLS: space_panes
-- ---------------------------------------------------------------------------

ALTER TABLE public.space_panes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "space_panes_select_visible_or_admin"
  ON public.space_panes
  FOR SELECT
  USING (
    is_visible = true
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );

CREATE POLICY "space_panes_insert_admin"
  ON public.space_panes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );

CREATE POLICY "space_panes_update_admin"
  ON public.space_panes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.spaces s
      JOIN public.communities c ON c.id = s.community_id
      WHERE s.id = space_panes.space_id
        AND c.admin_id = auth.uid()
    )
  );

-- No DELETE policy (Phase 1: UI does not expose pane delete)

-- ---------------------------------------------------------------------------
-- RLS: hossiis pane/space integrity (RESTRICTIVE — AND with existing policies)
-- ---------------------------------------------------------------------------

CREATE POLICY "hossii_pane_space_match_restrict"
  ON public.hossiis
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    space_pane_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.space_panes p
      WHERE p.id = space_pane_id
        AND p.space_id = hossiis.space_id
    )
  );

CREATE POLICY "hossii_pane_space_match_restrict_update"
  ON public.hossiis
  AS RESTRICTIVE
  FOR UPDATE
  WITH CHECK (
    space_pane_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.space_panes p
      WHERE p.id = space_pane_id
        AND p.space_id = hossiis.space_id
    )
  );
