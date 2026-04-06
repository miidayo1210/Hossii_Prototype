-- space_feature_flags.flag_key は feature_flags.key を参照するため、
-- アプリで使う各キーは feature_flags に1行ずつ存在している必要がある。
-- 未定義のキーへ upsert すると FK 違反で失敗し、再フェッチ後に UI が OFF に戻る。

insert into feature_flags (key, description, default_enabled) values
  ('random_recall_enabled', '内省スペースでランダム想起を有効にする', false),
  ('public_board_mode', '公開ボードモード', false),
  ('zine_export_enabled', 'ZINE出力', false),
  ('bubble_shapes_extended', '吹き出し形状の拡張選択', false),
  ('position_selector', '投稿時に3x3グリッドで位置を指定する', false)
on conflict (key) do nothing;
