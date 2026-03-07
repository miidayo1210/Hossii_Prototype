-- spaces テーブルに非公開フラグを追加
-- is_private: true のスペースは未ログインユーザーがURLアクセスしても入室できない（内省スペース向け）

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
