-- A05: moderation_logs テーブル
-- 管理者による投稿の非表示・復元操作を記録する監査ログ

CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id text NOT NULL,
  hossii_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('hide', 'restore')),
  admin_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- インデックス（スペースIDでの検索を高速化）
CREATE INDEX IF NOT EXISTS moderation_logs_space_id_idx ON moderation_logs (space_id);
CREATE INDEX IF NOT EXISTS moderation_logs_created_at_idx ON moderation_logs (created_at DESC);
