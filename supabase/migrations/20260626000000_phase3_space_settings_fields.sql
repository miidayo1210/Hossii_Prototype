-- Phase 3: 管理画面 IA — 正式設定フィールド追加

alter table space_settings
  add column if not exists posting_position_mode text default 'auto';

alter table space_settings
  add column if not exists random_recall_enabled boolean not null default false;

alter table spaces
  add column if not exists character_name text;

comment on column space_settings.posting_position_mode is '投稿位置モード: auto | selector';
comment on column space_settings.random_recall_enabled is '振り返り画面でのランダム想起 ON/OFF';
comment on column spaces.character_name is '中心キャラクターの表示名';
