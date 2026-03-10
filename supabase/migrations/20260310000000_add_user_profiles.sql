-- 個人ユーザープロフィールテーブル
-- auth.users と 1:1 で紐づく個人ユーザー専用の拡張情報
create table if not exists user_profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  username   text        not null,
  birthdate  date,
  gender     text        check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: 本人のみ読み書き可能
alter table user_profiles enable row level security;

create policy "Users can manage own profile"
  on user_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
