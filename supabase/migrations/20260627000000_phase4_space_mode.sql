ALTER TABLE space_settings
  ADD COLUMN IF NOT EXISTS applied_mode text DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS mode_customized boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mode_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS mode_snapshot jsonb;
