-- ============================================================
-- communities
-- コミュニティ（管理者が登録する上位エンティティ）
-- ============================================================
create table if not exists communities (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null,                    -- auth.users.id
  name        text        not null,                    -- コミュニティ名（表示用）
  slug        text        unique,                      -- URL 用スラッグ（将来: /c/[slug]）
  created_at  timestamptz not null default now()
);

-- index: admin_id による高速ルックアップ
create index if not exists communities_admin_id
  on communities (admin_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table communities enable row level security;

-- 全読み取り許可（デモ用）
create policy "public read communities"
  on communities for select using (true);

-- 本人のみ登録可
create policy "owner insert communities"
  on communities for insert with check (admin_id = auth.uid());

-- 本人のみ更新・削除可
create policy "owner update communities"
  on communities for update using (admin_id = auth.uid());

create policy "owner delete communities"
  on communities for delete using (admin_id = auth.uid());
