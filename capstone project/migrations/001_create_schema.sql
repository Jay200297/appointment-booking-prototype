-- Migration: 001_create_schema.sql
-- PostgreSQL schema for appointment booking platform

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clinics
CREATE TABLE clinic (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL,
  address jsonb,
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Providers
CREATE TABLE provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  external_calendar_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_provider_clinic ON provider(clinic_id);

-- Services
CREATE TABLE service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_minutes integer NOT NULL,
  price numeric(10,2),
  requires_precheckin boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_clinic ON service(clinic_id);

-- Patients
CREATE TABLE patient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  external_patient_ref text,
  first_name text,
  last_name text,
  dob date,
  email text,
  phone text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_clinic ON patient(clinic_id);

-- Provider availability (recurring rules + exceptions)
CREATE TABLE provider_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  recurring_rule text, -- store RRULE or JSON
  start_date date,
  end_date date,
  exceptions jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_provider_avail_provider ON provider_availability(provider_id);

-- Time slots
CREATE TYPE timeslot_status AS ENUM ('available','reserved','booked','blocked');

CREATE TABLE timeslot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES provider(id) ON DELETE SET NULL,
  service_id uuid REFERENCES service(id) ON DELETE SET NULL,
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  status timeslot_status NOT NULL DEFAULT 'available',
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_provider_start UNIQUE (provider_id, start_ts)
);
CREATE INDEX idx_timeslot_provider_start ON timeslot(provider_id, start_ts);
CREATE INDEX idx_timeslot_clinic_start ON timeslot(clinic_id, start_ts);

-- Appointments
CREATE TYPE appointment_status AS ENUM ('confirmed','cancelled','rescheduled','checked_in','completed','no_show');

CREATE TABLE appointment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid REFERENCES timeslot(id) ON DELETE SET NULL,
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES provider(id) ON DELETE SET NULL,
  service_id uuid REFERENCES service(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patient(id) ON DELETE SET NULL,
  status appointment_status NOT NULL DEFAULT 'confirmed',
  source text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appointment_patient ON appointment(patient_id);
CREATE INDEX idx_appointment_provider ON appointment(provider_id);

-- Waiting list
CREATE TABLE waiting_list_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES provider(id) ON DELETE SET NULL,
  service_id uuid REFERENCES service(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES patient(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text DEFAULT 'waiting'
);
CREATE INDEX idx_waiting_clinic ON waiting_list_entry(clinic_id);

-- Notifications
CREATE TYPE notification_channel AS ENUM ('sms','email','push');
CREATE TYPE notification_status AS ENUM ('queued','sent','failed');

CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointment(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',
  attempt_count integer DEFAULT 0,
  last_attempt_at timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_appointment ON notification(appointment_id);

-- Audit log
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text,
  entity_id uuid,
  action text,
  performed_by text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

COMMIT;
