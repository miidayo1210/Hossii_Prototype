-- ============================================================
-- Add space_url column to spaces table
-- ============================================================

alter table spaces
  add column if not exists space_url text unique;

-- index: space_url による高速ルックアップ
create index if not exists spaces_space_url
  on spaces (space_url)
  where space_url is not null;
