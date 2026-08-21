-- Migration: 008_fix_notification_table.sql
-- The notification table was correctly designed in 001, but the app code was
-- writing to columns that don't exist (type/recipient/message instead of
-- channel/payload) and never supplying the required clinic_id. Rather than
-- bolt mismatched columns onto a good schema, this migration adjusts the two
-- things the code legitimately needs and app code is fixed to match the rest:
--
-- 1. clinic_id becomes optional -- ad-hoc/test notifications (e.g. a manual
--    test SMS) may not be tied to a specific appointment/clinic at insert time.
-- 2. A dedicated read_at timestamp replaces overloading `status` (which
--    should reflect delivery outcome: queued/sent/failed) with a 'read' state
--    that was never a valid enum value in the first place.

BEGIN;

ALTER TABLE notification
  ALTER COLUMN clinic_id DROP NOT NULL,
  ADD COLUMN read_at timestamptz;

COMMIT;
