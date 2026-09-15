-- DOLE Mandatory OSH Training Program (editable per schedule, publishable to trainers)
ALTER TABLE tms.schedules
  ADD COLUMN IF NOT EXISTS osh_program jsonb;

COMMENT ON COLUMN tms.schedules.osh_program IS
  'Mandatory OSH Training Program form: checkboxes, sessions, resource persons, published flag for guest trainer access.';
