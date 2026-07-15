-- ============================================================================
-- Phase 2D-1 reconciliation (fix): guard_hossii_admin_columns の三値論理バグ修正
-- ----------------------------------------------------------------------------
-- 20260713140000 の guard_hossii_admin_columns には次のバグがある:
--   IF NOT ( (auth.jwt()->'app_metadata'->>'role') = 'super_admin' OR EXISTS(...admin...) )
-- JWT に app_metadata.role が無い一般ユーザーでは左辺が NULL となり、
--   NULL OR false = NULL, NOT NULL = NULL → IF は偽扱い → RAISE されず、
-- 一般 authenticated が他人の is_hidden / hidden_by / space_pane_id を変更できてしまう。
-- （community 管理者は EXISTS=true で通過していたため露見しにくかった。）
--
-- 修正: super_admin 判定を COALESCE で NULL 安全にする。EXISTS は常に true/false のため、
--       非管理者は確実に RAISE される。
-- 既存 migration は変更せず、CREATE OR REPLACE で関数本体のみ収束させる（append-only）。
-- development のみ適用。production 未操作。
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_hossii_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
       NEW.is_hidden     IS DISTINCT FROM OLD.is_hidden
    OR NEW.hidden_at     IS DISTINCT FROM OLD.hidden_at
    OR NEW.hidden_by     IS DISTINCT FROM OLD.hidden_by
    OR NEW.space_pane_id IS DISTINCT FROM OLD.space_pane_id
  ) AND auth.uid() IS NOT NULL THEN
    IF NOT (
      COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin', false)
      OR EXISTS (
        SELECT 1
        FROM public.spaces s
        JOIN public.communities c ON c.id = s.community_id
        WHERE s.id = NEW.space_id
          AND c.admin_id = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'hossiis moderation columns (is_hidden/hidden_at/hidden_by/space_pane_id) require community admin or super_admin';
    END IF;

    -- hidden_by 偽装防止: 実際に操作した管理者の uid を強制。復帰時(is_hidden=false)は NULL。
    IF NEW.is_hidden IS DISTINCT FROM OLD.is_hidden
       OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by THEN
      NEW.hidden_by := CASE WHEN NEW.is_hidden THEN auth.uid()::text ELSE NULL END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
