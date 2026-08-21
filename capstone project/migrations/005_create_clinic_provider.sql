-- Migration: 005_create_clinic_provider.sql
-- Adds the clinic_provider join table that providers.js and appointments.js
-- already query but which was never created, plus a demo link for seed data.

BEGIN;

CREATE TABLE clinic_provider (
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, provider_id)
);

CREATE INDEX idx_clinic_provider_provider ON clinic_provider(provider_id);

-- Link the demo provider (Dr. Alice Example) to the demo clinic so
-- GET /providers/me/clinics returns something out of the box.
INSERT INTO clinic_provider (clinic_id, provider_id)
VALUES ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

COMMIT;
