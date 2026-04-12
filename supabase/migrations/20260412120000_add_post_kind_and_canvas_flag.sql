-- キャンバス投稿（自由編集）: 吹き出し / キャンバス種別
ALTER TABLE hossiis
  ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'bubble';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hossiis_post_kind_check'
  ) THEN
    ALTER TABLE hossiis
      ADD CONSTRAINT hossiis_post_kind_check CHECK (post_kind IN ('bubble', 'canvas'));
  END IF;
END $$;

COMMENT ON COLUMN hossiis.post_kind IS 'bubble=従来の吹き出し投稿, canvas=自由編集ラスタ投稿';
