-- Migration: 003_create_users.sql
-- Adds a real users table so /auth/login and /auth/signup can verify credentials
-- instead of trusting whatever the client sends.

BEGIN;

CREATE TYPE user_role AS ENUM ('patient','provider','admin');

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinic(id) ON DELETE SET NULL, -- null for patients not tied to one clinic
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'patient',
  first_name text,
  last_name text,
  phone text,
  dob date,
  provider_id uuid REFERENCES provider(id) ON DELETE SET NULL, -- set when role = 'provider'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_user_email ON app_user(email);
CREATE INDEX idx_app_user_clinic ON app_user(clinic_id);

COMMIT;
