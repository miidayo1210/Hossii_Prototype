-- numberPost: 数値投稿（体温・歩数など）
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS number_value float DEFAULT NULL;

-- A05: hidden_at / hidden_by カラム（F06の監査ログ対応）
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS hidden_at timestamptz DEFAULT NULL;
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS hidden_by text DEFAULT NULL;
