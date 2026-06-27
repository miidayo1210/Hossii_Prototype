-- Phase 1 follow-up: tighten authorship trigger function execute grants
-- remote 20260627100000 適用済み環境向け差分（table / trigger 本体は再作成しない）

REVOKE ALL ON FUNCTION public.link_hossii_authorship_after_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_hossii_authorship_after_insert() FROM anon, authenticated;
