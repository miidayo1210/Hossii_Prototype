-- ============================================================
-- Expand participant account slots from 20 to 50 per space
-- ============================================================

ALTER TABLE space_participant_accounts
  DROP CONSTRAINT IF EXISTS space_participant_accounts_slot_number_check;

ALTER TABLE space_participant_accounts
  ADD CONSTRAINT space_participant_accounts_slot_number_check
  CHECK (slot_number BETWEEN 1 AND 50);
