-- Phase 10A: backfill legacy NULL space_pane_id to default pane
-- Phase 10D: enable Realtime on space_panes

UPDATE public.hossiis h
SET space_pane_id = p.id
FROM public.space_panes p
WHERE h.space_id = p.space_id
  AND p.is_default = true
  AND h.space_pane_id IS NULL;

ALTER TABLE public.space_panes REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'space_panes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_panes;
  END IF;
END $$;
