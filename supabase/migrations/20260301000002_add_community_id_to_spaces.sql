-- community_id カラムが存在しない場合のみ追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spaces' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE spaces ADD COLUMN community_id uuid REFERENCES communities(id);
  END IF;
END $$;

-- 既存スペースを Hossiitest アカウントのコミュニティに紐付け（community_id が NULL のものだけ）
UPDATE spaces
  SET community_id = (
    SELECT id FROM communities WHERE admin_id = (
      SELECT id FROM auth.users WHERE email = 'Hossiitest@gmail.com'
    )
    LIMIT 1
  )
WHERE community_id IS NULL;

-- RLS を有効化
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除してから再作成（冪等）
DROP POLICY IF EXISTS "spaces_select_all" ON spaces;
DROP POLICY IF EXISTS "spaces_select_own" ON spaces;
DROP POLICY IF EXISTS "spaces_insert_own" ON spaces;
DROP POLICY IF EXISTS "spaces_update_own" ON spaces;
DROP POLICY IF EXISTS "spaces_delete_own" ON spaces;
DROP POLICY IF EXISTS "spaces_select_by_url_anon" ON spaces;

-- SELECT: 認証済みユーザー・ゲスト問わず全員がスペースを参照可能
-- （一般参加者が /s/[slug] でスペースに入室するために必要）
-- 管理者のスペース絞り込みはアプリ側（fetchSpaces(communityId)）で行う
CREATE POLICY "spaces_select_all" ON spaces
  FOR SELECT USING (true);

-- INSERT: 自分のコミュニティの community_id のみ挿入可
CREATE POLICY "spaces_insert_own" ON spaces
  FOR INSERT WITH CHECK (
    community_id = (SELECT id FROM communities WHERE admin_id = auth.uid())
  );

-- UPDATE: 自分のコミュニティのスペースのみ更新可
CREATE POLICY "spaces_update_own" ON spaces
  FOR UPDATE USING (
    community_id = (SELECT id FROM communities WHERE admin_id = auth.uid())
  );

-- DELETE: 自分のコミュニティのスペースのみ削除可
CREATE POLICY "spaces_delete_own" ON spaces
  FOR DELETE USING (
    community_id = (SELECT id FROM communities WHERE admin_id = auth.uid())
  );
