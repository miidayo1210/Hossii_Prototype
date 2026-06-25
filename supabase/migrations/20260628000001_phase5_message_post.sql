ALTER TABLE space_settings
  ADD COLUMN IF NOT EXISTS feature_message_post boolean;

UPDATE space_settings
  SET feature_message_post = feature_comment_post
  WHERE feature_message_post IS NULL;
