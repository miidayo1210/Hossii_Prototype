-- Phase 5: 廃止列の削除（適用前に card_type / space_name / feature_* の分布を確認すること）

ALTER TABLE space_settings
  DROP COLUMN IF EXISTS space_name,
  DROP COLUMN IF EXISTS card_type,
  DROP COLUMN IF EXISTS hossii_color,
  DROP COLUMN IF EXISTS feature_comment_post,
  DROP COLUMN IF EXISTS feature_emotion_post,
  DROP COLUMN IF EXISTS feature_photo_post,
  DROP COLUMN IF EXISTS feature_number_post,
  DROP COLUMN IF EXISTS feature_message_post;

ALTER TABLE spaces
  DROP COLUMN IF EXISTS card_type;
