-- T02 foundation: hossiis.tags（プリセットタグ永続化の前提カラム）
--
-- 目的:
--   投稿に付与したプリセットタグを保存するための列を、リポジトリ管理の
--   正式 migration として追加する。
--
-- 設計:
--   既存の hashtags（20260227000000: text[] DEFAULT '{}'）に合わせる。
--   - 型: text[]
--   - DEFAULT: '{}'
--   - NULL 許容（NOT NULL は付けない。hashtags と同じ）
--   - 標準値は空配列 '{}'（未設定の意味はアプリ層で null/undefined 扱いに正規化）
--
-- 既存レコード:
--   ADD COLUMN ... DEFAULT '{}' により、既存行は '{}' として読める。
--   hashtags / その他の列には触れない。
--
-- 既存環境で同名カラムがある場合:
--   IF NOT EXISTS により no-op。
--   手動で jsonb 等が既にある環境では型を変更しない
--   （別タスクで text[] へ揃える）。
--
-- Rollback:
--   ALTER TABLE public.hossiis DROP COLUMN IF EXISTS tags;

ALTER TABLE public.hossiis
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

COMMENT ON COLUMN public.hossiis.tags IS
  'T02: preset tags selected from spaces.preset_tags (text[], aligned with hashtags)';
