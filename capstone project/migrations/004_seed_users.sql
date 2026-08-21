-- Migration: 004_seed_users.sql
-- Demo login accounts, seeded after app_user exists (migration 003).
-- Password for all three accounts: "Password123!"
-- Generated with bcryptjs, 12 salt rounds. Change these before using outside local dev.

BEGIN;

INSERT INTO app_user (id, clinic_id, email, password_hash, role, first_name, last_name, provider_id)
VALUES
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'patient@example.com', '$2a$12$Mgzuw.ZxgNz/OzRaKBBuCOT.5BQXIqtBGGp6.fDqkZnYS/Pg2wTYi', 'patient', 'Demo', 'Patient', NULL),
  ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', 'provider@example.com', '$2a$12$Mgzuw.ZxgNz/OzRaKBBuCOT.5BQXIqtBGGp6.fDqkZnYS/Pg2wTYi', 'provider', 'Alice', 'Example', '22222222-2222-4222-8222-222222222222'),
  ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111', 'admin@example.com', '$2a$12$Mgzuw.ZxgNz/OzRaKBBuCOT.5BQXIqtBGGp6.fDqkZnYS/Pg2wTYi', 'admin', 'Demo', 'Admin', NULL);

COMMIT;
