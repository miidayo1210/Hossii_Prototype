-- ============================================================
-- communities テーブルに status カラムを追加
-- 申請→審査→承認フローのため
-- ============================================================

-- 既存レコードはすべて 'approved'（テスト用の Hossiitest アカウント等）
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved';

-- 制約を追加
ALTER TABLE communities
  ADD CONSTRAINT communities_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- NOT NULL 制約
ALTER TABLE communities
  ALTER COLUMN status SET NOT NULL;

-- 新規登録はデフォルト 'pending'（審査待ち）に変更
ALTER TABLE communities
  ALTER COLUMN status SET DEFAULT 'pending';
