-- ============================================================
-- いいね機能
-- hossii_likes テーブル + like_count キャッシュ + Feature Flag
-- ============================================================

-- likes Feature Flag の追加
insert into feature_flags (key, description, default_enabled)
values ('likes_enabled', '投稿へのいいね機能', false)
on conflict (key) do nothing;

-- ============================================================
-- hossii_likes テーブル
-- ============================================================
create table if not exists hossii_likes (
  hossii_id   text        not null references hossiis(id) on delete cascade,
  user_id     text        not null,
  created_at  timestamptz not null default now(),
  primary key (hossii_id, user_id)
);

comment on table hossii_likes is '投稿へのいいね。(hossii_id, user_id) の複合PKで一人一票を保証。';

-- ============================================================
-- hossiis テーブルに like_count キャッシュカラムを追加
-- ============================================================
alter table hossiis
  add column if not exists like_count integer not null default 0;

comment on column hossiis.like_count is 'いいね数のキャッシュ。hossii_likes の INSERT/DELETE トリガーで自動更新。';

-- ============================================================
-- like_count 自動更新トリガー
-- ============================================================
create or replace function update_like_count()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    update hossiis set like_count = like_count + 1 where id = NEW.hossii_id;
  elsif (TG_OP = 'DELETE') then
    update hossiis set like_count = greatest(like_count - 1, 0) where id = OLD.hossii_id;
  end if;
  return null;
end;
$$;

create or replace trigger hossii_likes_update_count
  after insert or delete on hossii_likes
  for each row execute function update_like_count();

-- ============================================================
-- インデックス
-- ============================================================
create index if not exists hossii_likes_hossii_id
  on hossii_likes (hossii_id);

create index if not exists hossii_likes_user_id
  on hossii_likes (user_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table hossii_likes enable row level security;

-- 全員読み取り可（いいね数の表示）
create policy "hossii_likes_select_all"
  on hossii_likes for select using (true);

-- ログイン済みユーザーは自分のいいねを追加可能
create policy "hossii_likes_insert_own"
  on hossii_likes for insert
  with check (auth.uid()::text = user_id);

-- 自分のいいねのみ削除可能
create policy "hossii_likes_delete_own"
  on hossii_likes for delete
  using (auth.uid()::text = user_id);
