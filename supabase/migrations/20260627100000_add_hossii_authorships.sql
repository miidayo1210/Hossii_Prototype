-- Phase 1: private authorship link between auth.users and hossiis (案 B)
-- hossiis には Auth UID を保存せず、非公開テーブルで本人関係を管理する

-- ---------------------------------------------------------------------------
-- hossii_authorships table
-- ---------------------------------------------------------------------------

CREATE TABLE public.hossii_authorships (
  hossii_id    text PRIMARY KEY
                 REFERENCES public.hossiis(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL
                 REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hossii_authorships_auth_user_created_idx
  ON public.hossii_authorships (auth_user_id, created_at DESC);
-- ---------------------------------------------------------------------------
-- RLS: authenticated SELECT own rows only; no client writes
-- ---------------------------------------------------------------------------

ALTER TABLE public.hossii_authorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY authorships_select_own
  ON public.hossii_authorships
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
REVOKE ALL ON public.hossii_authorships FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.hossii_authorships FROM authenticated;
GRANT SELECT ON public.hossii_authorships TO authenticated;
-- ---------------------------------------------------------------------------
-- Trigger: create authorship on authenticated hossiis INSERT
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_hossii_authorship_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.hossii_authorships (hossii_id, auth_user_id)
    VALUES (NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.link_hossii_authorship_after_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_hossii_authorship_after_insert() TO postgres, service_role;
CREATE TRIGGER hossiis_after_insert_link_authorship
  AFTER INSERT ON public.hossiis
  FOR EACH ROW
  EXECUTE FUNCTION public.link_hossii_authorship_after_insert();
