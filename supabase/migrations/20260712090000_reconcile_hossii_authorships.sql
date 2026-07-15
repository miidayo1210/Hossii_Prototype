-- ============================================================================
-- reconcile_hossii_authorships  (Phase 1B-1)
-- ----------------------------------------------------------------------------
-- 目的:
--   production と development の間に生じた hossii_authorships のドリフトを、
--   1 本の冪等 migration で収束させる。
--
-- 確認済みの前提状態:
--   production   : hossii_authorships 本体 / index / RLS / policy / function /
--                  trigger が既に存在（版 20260627100000 が履歴に未記録のまま実適用）。
--   development  : authorship 一式が存在しない。
--
-- 収束方針:
--   IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS のみで構成し、
--   production（既存あり）でも development（無し）でも同一 SQL が安全に通る。
--   DROP TABLE / DROP COLUMN / DELETE / UPDATE / TRUNCATE は含めない
--   （production の既存 authorship データ 20 件を保全する）。
--
-- 限界（明記）:
--   CREATE TABLE IF NOT EXISTS は「テーブルが無ければ作る」だけであり、
--   既存テーブルに未知の部分的な構造差異（列欠落・型差・制約差など）が
--   あっても自動修復しない。本 migration は複雑な自動 ALTER・制約再構築・
--   DO ブロックを行わず小差分を維持する。想定外の構造差異が判明した場合は
--   別途 reconciliation migration を追加する。
--
-- trigger の本人性データは fail-closed を維持する（ON CONFLICT DO NOTHING を付けない）。
--   authorship の INSERT が失敗した場合は元の hossii INSERT ごと rollback される。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hossii_authorships (
  hossii_id    text PRIMARY KEY
                 REFERENCES public.hossiis(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL
                 REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS hossii_authorships_auth_user_created_idx
  ON public.hossii_authorships (auth_user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. RLS enable
-- ---------------------------------------------------------------------------
ALTER TABLE public.hossii_authorships ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. policy: authenticated は自分の行のみ SELECT 可
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS authorships_select_own ON public.hossii_authorships;
CREATE POLICY authorships_select_own
  ON public.hossii_authorships
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. table grants 正規化
--    最終状態: anon=なし / authenticated=SELECT のみ / service_role・postgres は既存維持
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.hossii_authorships FROM anon, authenticated;
GRANT SELECT ON public.hossii_authorships TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. trigger function (CREATE OR REPLACE)
--    SECURITY DEFINER / search_path='' / ON CONFLICT なし（fail-closed）
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

-- ---------------------------------------------------------------------------
-- 7. function grants 正規化
--    PUBLIC / anon / authenticated から EXECUTE を外す。
--    トリガー経由の実行は EXECUTE 権限を要求せず、かつ SECURITY DEFINER
--    (owner=postgres) のため、service_role への明示 EXECUTE 付与は不要。
--    ここでは owner(postgres) の権限のみ保持し、追加の GRANT は行わない。
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.link_hossii_authorship_after_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_hossii_authorship_after_insert() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. trigger (DROP IF EXISTS + CREATE)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS hossiis_after_insert_link_authorship ON public.hossiis;
CREATE TRIGGER hossiis_after_insert_link_authorship
  AFTER INSERT ON public.hossiis
  FOR EACH ROW
  EXECUTE FUNCTION public.link_hossii_authorship_after_insert();
