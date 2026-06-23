-- 吹き出し編集権限（GeneralTab bubbleEditPermission）
ALTER TABLE space_settings
  ADD COLUMN IF NOT EXISTS bubble_edit_permission text NOT NULL DEFAULT 'all'
  CHECK (bubble_edit_permission IN ('all', 'owner_and_admin'));

COMMENT ON COLUMN space_settings.bubble_edit_permission IS '吹き出し編集権限: all = 全員, owner_and_admin = 投稿者と管理者のみ';
