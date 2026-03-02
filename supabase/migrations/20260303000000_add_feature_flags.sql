-- ============================================================
-- Feature Flags
-- スペース単位でON/OFFできる機能フラグ
-- A段階: space単位でのoverride
-- B段階（将来）: tenant/user単位のoverride拡張を想定した構造
-- ============================================================

-- ============================================================
-- feature_flags
-- フラグの定義とデフォルト値（グローバル設定）
-- ============================================================
create table if not exists feature_flags (
  key             text        primary key,              -- フラグキー (e.g. "comments_thumbnail")
  description     text        not null default '',      -- 人間が読める説明
  default_enabled boolean     not null default false,   -- 未設定時のデフォルト値
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table feature_flags is 'Feature Flag の定義とデフォルト値。key は "comments_thumbnail" などのスネークケース文字列。';

-- ============================================================
-- space_feature_flags
-- スペース単位の Feature Flag override
-- spaces.id は text 型のため FK は text で定義
-- ============================================================
create table if not exists space_feature_flags (
  space_id        text        not null references spaces(id) on delete cascade,
  flag_key        text        not null references feature_flags(key) on delete cascade,
  enabled         boolean     not null,
  -- 監査用（B段階でwho/whenを追える構造）
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      text,       -- profiles.id（設定した管理者の端末ID）
  updated_by      text,       -- profiles.id（最後に変更した管理者の端末ID）
  primary key (space_id, flag_key)
);

comment on table space_feature_flags is 'スペース単位の Feature Flag override。feature_flags.default_enabled をこのテーブルで上書きできる。';

-- updated_at 自動更新トリガー
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger feature_flags_updated_at
  before update on feature_flags
  for each row execute function update_updated_at_column();

create or replace trigger space_feature_flags_updated_at
  before update on space_feature_flags
  for each row execute function update_updated_at_column();

-- ============================================================
-- インデックス
-- ============================================================
create index if not exists space_feature_flags_space_id
  on space_feature_flags (space_id);

-- ============================================================
-- 初期フラグの定義
-- ============================================================
insert into feature_flags (key, description, default_enabled) values
  ('comments_thumbnail', 'コメント一覧で画像サムネイルを表示する', true)
on conflict (key) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================

-- feature_flags: 全員読み取り可、管理者のみ変更（RLSはシンプルに全読み取り）
alter table feature_flags enable row level security;

create policy "feature_flags_select_all"
  on feature_flags for select using (true);

-- space_feature_flags: 全員読み取り可（フラグ取得はクライアントから行う）
alter table space_feature_flags enable row level security;

create policy "space_feature_flags_select_all"
  on space_feature_flags for select using (true);

-- INSERT/UPDATE/DELETE: 対象スペースのコミュニティ管理者のみ
-- （spaces → communities → admin_id = auth.uid()）
create policy "space_feature_flags_insert_admin"
  on space_feature_flags for insert
  with check (
    exists (
      select 1 from spaces s
      join communities c on c.id = s.community_id
      where s.id = space_id
        and c.admin_id = auth.uid()
    )
  );

create policy "space_feature_flags_update_admin"
  on space_feature_flags for update
  using (
    exists (
      select 1 from spaces s
      join communities c on c.id = s.community_id
      where s.id = space_id
        and c.admin_id = auth.uid()
    )
  );

create policy "space_feature_flags_delete_admin"
  on space_feature_flags for delete
  using (
    exists (
      select 1 from spaces s
      join communities c on c.id = s.community_id
      where s.id = space_id
        and c.admin_id = auth.uid()
    )
  );
