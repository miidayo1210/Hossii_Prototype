-- ============================================================
-- Hossii Prototype - Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- ユーザーのローカルプロフィール（端末固有ID + ニックネーム）
-- ============================================================
create table if not exists profiles (
  id            text        primary key,         -- 端末固有ID（generateId）
  default_nickname text     not null default '',  -- デフォルトニックネーム
  created_at    timestamptz not null default now()
);

-- ============================================================
-- space_nicknames
-- スペースごとのニックネーム（profiles 1:N）
-- ============================================================
create table if not exists space_nicknames (
  profile_id  text        not null references profiles(id) on delete cascade,
  space_id    text        not null,
  nickname    text        not null default '',
  primary key (profile_id, space_id)
);

-- ============================================================
-- spaces
-- スペース（感情・投稿を共有するルーム）
-- ============================================================
create table if not exists spaces (
  id              text        primary key,
  name            text        not null,
  card_type       text        not null default 'constellation'
                              check (card_type in ('stamp', 'constellation')),
  quick_emotions  text[]      not null default '{"joy","wow","think","empathy","inspire","laugh","moved","fun"}',
  background      jsonb       not null default '{"kind":"pattern","value":"mist"}',
  -- background の shape:
  --   color:   { "kind": "color",   "value": "#EAF4FF" }
  --   pattern: { "kind": "pattern", "value": "mist" }
  --   image:   { "kind": "image",   "value": "/bg/space.jpg", "source": "preset" }
  created_at      timestamptz not null default now()
);

-- ============================================================
-- hossiis
-- 投稿（気持ち / メッセージ）
-- ============================================================
create table if not exists hossiis (
  id            text        primary key,
  message       text        not null default '',
  emotion       text        check (emotion in ('wow','empathy','inspire','think','laugh','joy','moved','fun')),
  space_id      text        not null references spaces(id) on delete cascade,
  author_id     text,                              -- 端末固有ID（匿名可）
  author_name   text,                              -- 表示用ニックネーム
  origin        text        not null default 'manual'
                            check (origin in ('manual','auto')),
  auto_type     text        check (auto_type in ('emotion','speech','laughter')),
  speech_level  text        check (speech_level in ('word','short','long')),
  language      text        check (language in ('ja','en','unknown')),
  log_type      text        check (log_type in ('emotion','speech')),  -- 後方互換
  created_at    timestamptz not null default now()
);

-- index: スペースごとの投稿取得（新しい順）
create index if not exists hossiis_space_id_created_at
  on hossiis (space_id, created_at desc);

-- index: ユーザーごとの投稿取得
create index if not exists hossiis_author_id
  on hossiis (author_id);

-- ============================================================
-- space_settings
-- スペースごとの詳細設定（SpaceSettingsScreen で管理）
-- ============================================================
create table if not exists space_settings (
  space_id            text        primary key references spaces(id) on delete cascade,
  space_name          text        not null default '',
  feature_comment_post  boolean   not null default true,
  feature_emotion_post  boolean   not null default true,
  feature_photo_post    boolean   not null default true,
  feature_number_post   boolean   not null default false,
  card_type           text        not null default 'constellation'
                                  check (card_type in ('stamp','constellation','graph')),
  hossii_color        text        not null default 'pink'
                                  check (hossii_color in ('pink','blue','yellow','green','purple')),
  background_pattern  text        not null default 'standard'
                                  check (background_pattern in ('standard','nebula','galaxy','stars')),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- stamps
-- スタンプ（手動投稿1件につき+1）
-- ============================================================
create table if not exists stamps (
  user_id       text        primary key,           -- profiles.id と対応
  count         integer     not null default 0,
  last_updated  timestamptz not null default now()
);

-- ============================================================
-- Row Level Security（RLS）
-- 将来的な認証導入時のためのプレースホルダー
-- 現状はデモ用に全公開
-- ============================================================

alter table profiles       enable row level security;
alter table space_nicknames enable row level security;
alter table spaces         enable row level security;
alter table hossiis        enable row level security;
alter table space_settings enable row level security;
alter table stamps         enable row level security;

-- 全読み取り許可（デモ用）
create policy "public read profiles"        on profiles        for select using (true);
create policy "public read space_nicknames" on space_nicknames for select using (true);
create policy "public read spaces"          on spaces          for select using (true);
create policy "public read hossiis"         on hossiis         for select using (true);
create policy "public read space_settings"  on space_settings  for select using (true);
create policy "public read stamps"          on stamps          for select using (true);

-- 全書き込み許可（デモ用）
create policy "public insert profiles"        on profiles        for insert with check (true);
create policy "public insert space_nicknames" on space_nicknames for insert with check (true);
create policy "public insert spaces"          on spaces          for insert with check (true);
create policy "public insert hossiis"         on hossiis         for insert with check (true);
create policy "public insert space_settings"  on space_settings  for insert with check (true);
create policy "public insert stamps"          on stamps          for insert with check (true);

create policy "public update profiles"        on profiles        for update using (true);
create policy "public update space_nicknames" on space_nicknames for update using (true);
create policy "public update spaces"          on spaces          for update using (true);
create policy "public update hossiis"         on hossiis         for update using (true);
create policy "public update space_settings"  on space_settings  for update using (true);
create policy "public update stamps"          on stamps          for update using (true);

create policy "public delete spaces"          on spaces          for delete using (true);
create policy "public delete hossiis"         on hossiis         for delete using (true);
create policy "public delete space_settings"  on space_settings  for delete using (true);
create policy "public delete space_nicknames" on space_nicknames for delete using (true);
