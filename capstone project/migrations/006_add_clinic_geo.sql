-- Migration: 006_add_clinic_geo.sql
-- Adds coordinates to clinic so we can support "clinics near me" search.
-- Using plain lat/lng + a Haversine query rather than PostGIS/earthdistance,
-- since this dataset is small (dozens/hundreds of clinics, not millions) and
-- it avoids requiring extra Postgres extensions to be enabled.

BEGIN;

ALTER TABLE clinic
  ADD COLUMN latitude numeric(9,6),
  ADD COLUMN longitude numeric(9,6),
  ADD COLUMN phone text;

-- A plain index still helps prune obviously-out-of-range rows before the
-- Haversine calculation runs on the remainder.
CREATE INDEX idx_clinic_lat_lng ON clinic(latitude, longitude);

COMMIT;
