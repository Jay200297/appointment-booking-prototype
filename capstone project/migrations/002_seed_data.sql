-- Migration: 002_seed_data.sql
-- Sample seed data for appointment booking platform

BEGIN;

-- Clinic
INSERT INTO clinic (id, name, timezone, address, settings)
VALUES ('11111111-1111-4111-8111-111111111111', 'Demo Clinic', 'America/New_York', '{"line1": "123 Main St"}', '{"default_slot_duration": 30}');

-- Provider
INSERT INTO provider (id, clinic_id, name, role, external_calendar_id)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Dr. Alice Example', 'physician', NULL);

-- Service
INSERT INTO service (id, clinic_id, name, duration_minutes, price)
VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'General Consultation', 30, 75.00);

-- Patient
INSERT INTO patient (id, clinic_id, first_name, last_name, email, phone)
VALUES ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'John', 'Doe', 'john@example.com', '+15555550123');

-- Provider availability: use JSON for a simple recurring rule
-- days: Monday-Friday, 09:00-17:00, slot_duration 30, buffer 10 minutes
INSERT INTO provider_availability (id, provider_id, clinic_id, recurring_rule, start_date, end_date, exceptions)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '{"days": ["mon","tue","wed","thu","fri"], "start_time": "09:00", "end_time": "17:00", "slot_duration": 30, "buffer_minutes": 10}',
  NULL,
  NULL,
  '[]'
);

COMMIT;
