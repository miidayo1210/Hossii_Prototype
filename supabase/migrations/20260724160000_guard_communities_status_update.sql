-- ============================================================================
-- B-SA-SEC-1: communities.status self-approval guard
-- ----------------------------------------------------------------------------
-- 一般 community owner が communities.status を
-- pending / approved / rejected 間で直接変更できないようにする。
--
-- INSERT は 20260724150000 で pending のみに硬化済み。
-- 本 migration は UPDATE 経路の自己承認穴を BEFORE UPDATE trigger で塞ぐ。
--
-- 方針:
--   - NEW.status IS DISTINCT FROM OLD.status のときのみ判定
--   - auth.uid() あり（JWT 付き authenticated）かつ super_admin でなければ拒否
--   - super_admin は status 変更可（将来の承認/却下 UI / 既存運用）
--   - service_role / postgres / seed 等 JWT なし経路は auth.uid() IS NULL で素通り
--   - status 以外の列更新（name / description / slug / personal_space_template 等）は維持
--   - 既存 row の書換えなし（DDL: function + trigger のみ）
--
-- owner UPDATE policy の WITH CHECK 明示は、USING 省略時の既定動作と同等のため行わない。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_communities_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.uid() IS NOT NULL
     AND NOT COALESCE(
       (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin',
       false
     )
  THEN
    RAISE EXCEPTION 'communities.status changes require super_admin';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_communities_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_communities_status() FROM anon;
REVOKE ALL ON FUNCTION public.guard_communities_status() FROM authenticated;

DROP TRIGGER IF EXISTS guard_communities_status ON public.communities;
CREATE TRIGGER guard_communities_status
  BEFORE UPDATE ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_communities_status();
