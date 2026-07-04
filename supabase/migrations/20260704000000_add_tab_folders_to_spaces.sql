-- Tab folder definitions for SpacePaneBar (100C).
-- Pane folder membership stays on space_panes.settings.tabBar.
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS tab_folders jsonb;

COMMENT ON COLUMN spaces.tab_folders IS
  'Tab bar folder chips: [{ id, name, sortOrder }]. Synced across devices.';
