-- ============================================================
-- fix: update_like_count trigger runs as invoker and hits RLS on hossiis
--
-- authenticated INSERT into hossii_likes succeeds, but the AFTER trigger
-- UPDATE on hossiis fails with 42501 (permission denied). Run the trigger
-- function as SECURITY DEFINER with an empty search_path and explicit
-- public.hossiis references so like_count stays in sync without granting
-- authenticated direct UPDATE on hossiis.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.hossiis
    SET like_count = like_count + 1
    WHERE id = NEW.hossii_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.hossiis
    SET like_count = greatest(like_count - 1, 0)
    WHERE id = OLD.hossii_id;
  END IF;
  RETURN NULL;
END;
$$;
