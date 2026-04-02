ALTER TABLE space_settings
  ADD COLUMN IF NOT EXISTS bottle_frequency TEXT NOT NULL DEFAULT '3d-7d';
