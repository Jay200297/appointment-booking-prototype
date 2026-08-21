-- Migration: 007_seed_real_clinics.sql
-- Real clinics (Port Harcourt, Rivers State, Nigeria) to replace the single
-- fictional "Demo Clinic" with something the nearby-search feature can
-- actually return useful results for. Update/replace with your own service
-- area's clinics as needed -- these are just a starting point.

BEGIN;

INSERT INTO clinic (id, name, timezone, address, phone, latitude, longitude, settings) VALUES
  (gen_random_uuid(), 'Meridian Hospitals', 'Africa/Lagos',
   '{"line1": "21 Igbokwe St, Phalga", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 808 282 6030', 4.801138, 6.997529, '{"default_slot_duration": 30}'),

  (gen_random_uuid(), 'PALMARS Hospital Limited', 'Africa/Lagos',
   '{"line1": "5, 7 Agip Rd, Rumueme", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 2084 30 4094', 4.811541, 6.981109, '{"default_slot_duration": 30}'),

  (gen_random_uuid(), 'First Rivers Hospital Limited', 'Africa/Lagos',
   '{"line1": "7/9 Old Aba Rd, Rumuomasi", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 815 849 3600', 4.836157, 7.022339, '{"default_slot_duration": 30}'),

  (gen_random_uuid(), 'SaveALife Mission Hospital', 'Africa/Lagos',
   '{"line1": "38 Uyo Street, off Stadium Road, Rumuomasi", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 803 710 8150', 4.829101, 7.019637, '{"default_slot_duration": 30}'),

  (gen_random_uuid(), 'Pamo Clinics and Hospitals Ltd', 'Africa/Lagos',
   '{"line1": "300 Aba Rd, Rumuola", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 808 375 2884', 4.837176, 7.024535, '{"default_slot_duration": 30}'),

  (gen_random_uuid(), 'Lily Hospital Limited', 'Africa/Lagos',
   '{"line1": "Plot 4 Close D, Peace Valley Estate, Trans Woji Road, Trans Amadi", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 803 312 2337', 4.817073, 7.050637, '{"default_slot_duration": 30}'),

  (gen_random_uuid(), 'St. Martins Hospital', 'Africa/Lagos',
   '{"line1": "62 Stadium Rd, Rumuola", "city": "Port Harcourt", "state": "Rivers", "country": "Nigeria"}',
   '+234 802 805 6241', 4.823814, 7.015732, '{"default_slot_duration": 30}');

COMMIT;
