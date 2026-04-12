-- 自由編集タブは Feature Flag なしで常時表示に変更したため定義を削除
-- space_feature_flags は feature_flags(key) ON DELETE CASCADE により連動削除
DELETE FROM feature_flags WHERE key = 'canvas_post_enabled';
