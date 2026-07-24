-- T02 Production prep: hossiis.tags jsonb → text[] 型統一
--
-- 背景:
--   正本（20260724200000 / Development）は tags text[] DEFAULT '{}'。
--   Production には手動追加の tags jsonb DEFAULT '[]'::jsonb が残っている。
--   20260724200000 の IF NOT EXISTS は列がある環境では no-op のため型は揃わない。
--
-- この migration:
--   - udt = jsonb のときだけ適用前検査のうえ text[] へ変換
--   - udt = _text（既に text[]）なら DEFAULT を揃えて no-op
--   - 列が無い場合のみ text[] を追加（20260724200000 未適用環境の保険）
--   - hashtags および他カラムには触れない
--
-- 変換実装メモ:
--   ALTER ... TYPE ... USING ではサブクエリが使えないため、
--   IMMUTABLE SQL 関数経由で jsonb_array_elements_text を呼ぶ。
--   関数は変換後に DROP する（恒久オブジェクトを残さない）。
--
-- 適用前検査（jsonb 時）:
--   - 配列以外の jsonb → EXCEPTION で停止
--   - 配列要素が string 以外 → EXCEPTION で停止
--
-- NULL / 空配列:
--   - NULL → NULL（維持）
--   - '[]'::jsonb → '{}'::text[]
--   - 文字列配列 → 順序を保って text[]
--
-- DEFAULT / nullable（正本に揃える）:
--   - DEFAULT '{}'::text[]
--   - NULL 許容（NOT NULL は付けない）
--
-- Rollback / バックアップ:
--   - TYPE 変更の単純 down は困難（アプリ rollback だけでは DB は戻らない）
--   - 適用前に pg_dump（またはテーブル論理バックアップ）を推奨
--   - 恒久的なバックアップ列は残さない（最小差分）
--
-- 注意:
--   Production への適用は別途・明示許可後に行う。本ファイル作成時点では未適用。

CREATE OR REPLACE FUNCTION public.hossii_tags_jsonb_to_text_array(j jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN j IS NULL THEN NULL
    ELSE ARRAY(SELECT jsonb_array_elements_text(j))
  END;
$$;

DO $$
DECLARE
  col_udt text;
  bad_non_array bigint;
  bad_non_string bigint;
BEGIN
  SELECT c.udt_name
  INTO col_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'hossiis'
    AND c.column_name = 'tags';

  IF col_udt IS NULL THEN
    ALTER TABLE public.hossiis
      ADD COLUMN tags text[] DEFAULT '{}';
    COMMENT ON COLUMN public.hossiis.tags IS
      'T02: preset tags selected from spaces.preset_tags (text[], aligned with hashtags)';
    RETURN;
  END IF;

  IF col_udt = '_text' THEN
    ALTER TABLE public.hossiis
      ALTER COLUMN tags SET DEFAULT '{}';
    COMMENT ON COLUMN public.hossiis.tags IS
      'T02: preset tags selected from spaces.preset_tags (text[], aligned with hashtags)';
    RETURN;
  END IF;

  IF col_udt <> 'jsonb' THEN
    RAISE EXCEPTION
      'hossiis.tags has unexpected udt_name=% (expected jsonb or _text); refusing conversion',
      col_udt;
  END IF;

  SELECT count(*)
  INTO bad_non_array
  FROM public.hossiis
  WHERE tags IS NOT NULL
    AND jsonb_typeof(tags) <> 'array';

  IF bad_non_array > 0 THEN
    RAISE EXCEPTION
      'hossiis.tags has % row(s) with non-array jsonb; refusing conversion to text[]',
      bad_non_array;
  END IF;

  SELECT count(*)
  INTO bad_non_string
  FROM public.hossiis
  WHERE jsonb_typeof(tags) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(tags) AS e(value)
      WHERE jsonb_typeof(e.value) <> 'string'
    );

  IF bad_non_string > 0 THEN
    RAISE EXCEPTION
      'hossiis.tags has % row(s) with non-string array elements; refusing conversion to text[]',
      bad_non_string;
  END IF;

  ALTER TABLE public.hossiis
    ALTER COLUMN tags DROP DEFAULT;

  ALTER TABLE public.hossiis
    ALTER COLUMN tags TYPE text[]
    USING public.hossii_tags_jsonb_to_text_array(tags);

  ALTER TABLE public.hossiis
    ALTER COLUMN tags SET DEFAULT '{}';

  COMMENT ON COLUMN public.hossiis.tags IS
    'T02: preset tags selected from spaces.preset_tags (text[], aligned with hashtags)';
END $$;

DROP FUNCTION IF EXISTS public.hossii_tags_jsonb_to_text_array(jsonb);
