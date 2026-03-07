-- ============================================================
-- space_settings テーブルにいいね機能 ON/OFF 列を追加
-- デフォルト true（新規スペースはいいね機能 ON）
-- ============================================================

alter table space_settings
  add column if not exists feature_likes_enabled boolean not null default true;

comment on column space_settings.feature_likes_enabled is 'いいね機能の ON/OFF。true の場合、スペース上の吹き出しにいいねボタンを表示する。';
