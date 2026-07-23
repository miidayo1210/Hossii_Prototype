-- ============================================================================
-- add_hossii_connection_reason_columns  (126 R1: reason_text / reason_emoji)
-- ----------------------------------------------------------------------------
-- Type A reason 用の任意メタデータ列を追加する。
-- 正規化: 専用 BEFORE trigger（guard_hossii_connection_row とは分離）。
-- 検証: CHECK 制約（50 字・改行禁止・emoji プリセット）。
-- 既存行: NULL のまま維持。RLS / guard trigger / strength / created_by は変更しない。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.hossii_connections
  ADD COLUMN IF NOT EXISTS reason_text varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS reason_emoji text NULL;

-- ---------------------------------------------------------------------------
-- 2. CHECK constraints（正規化後の値を検証）
-- ---------------------------------------------------------------------------
ALTER TABLE public.hossii_connections
  DROP CONSTRAINT IF EXISTS hossii_connections_reason_text_format;

ALTER TABLE public.hossii_connections
  ADD CONSTRAINT hossii_connections_reason_text_format CHECK (
    reason_text IS NULL
    OR (
      char_length(reason_text) <= 50
      AND reason_text !~ '[\n\r\x0B\x0C]'
    )
  );

ALTER TABLE public.hossii_connections
  DROP CONSTRAINT IF EXISTS hossii_connections_reason_emoji_preset;

ALTER TABLE public.hossii_connections
  ADD CONSTRAINT hossii_connections_reason_emoji_preset CHECK (
    reason_emoji IS NULL
    OR reason_emoji IN (
      '💡',
      '🔗',
      '🌱',
      '💬',
      '↔️',
      '🎯',
      '❤️',
      '❓'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. normalization trigger（空文字・空白のみ → NULL）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_hossii_connection_reason()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reason_text IS NOT NULL THEN
    NEW.reason_text := NULLIF(btrim(NEW.reason_text), '');
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_hossii_connection_reason() FROM PUBLIC;

DROP TRIGGER IF EXISTS hossii_connections_normalize_reason ON public.hossii_connections;
CREATE TRIGGER hossii_connections_normalize_reason
  BEFORE INSERT OR UPDATE OF reason_text, reason_emoji ON public.hossii_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_hossii_connection_reason();
