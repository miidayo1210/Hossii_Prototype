-- 投稿フォーム項目設定（仕様 86）
ALTER TABLE space_settings
  ADD COLUMN IF NOT EXISTS post_fields jsonb NOT NULL DEFAULT '{
    "message": {"enabled": true, "required": false},
    "emotion": {"enabled": true, "required": false},
    "tags": {"enabled": true, "required": false},
    "photo": {"enabled": true, "required": false},
    "bubbleColor": {"enabled": true, "required": false},
    "bubbleShape": {"enabled": true, "required": false},
    "numberPost": {"enabled": false, "required": false}
  }'::jsonb;

COMMENT ON COLUMN space_settings.post_fields IS '投稿パネル各項目の表示/必須設定（PostFieldSettings）';
