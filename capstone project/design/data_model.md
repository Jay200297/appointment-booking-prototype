Appointment Booking — Data Model (ERD)

Purpose

- Define core entities and relationships for the appointment booking platform.

Entities

1. Clinic

- id (UUID PK)
- name
- timezone
- address
- settings JSON (business rules)

2. Provider

- id (UUID PK)
- clinic_id (FK -> clinic.id)
- name
- role (physician, nurse, etc.)
- external_calendar_id
- metadata JSON

3. Service

- id (UUID PK)
- clinic_id (FK)
- name
- duration_minutes
- price
- requires_precheckin BOOL

4. Patient

- id (UUID PK)
- clinic_id (FK)
- external_patient_ref (optional)
- first_name, last_name, dob, email, phone
- metadata JSON

5. ProviderAvailability

- id (UUID PK)
- provider_id (FK)
- clinic_id (FK)
- recurring_rule (RFC 5545 RRULE or simplified JSON)
- start_date, end_date (optional)
- exceptions JSON

6. TimeSlot

- id (UUID PK)
- clinic_id (FK)
- provider_id (FK)
- service_id (FK)
- start_ts (timestamp with time zone)
- end_ts
- status (enum: available,reserved,booked,blocked)
- created_by
- locked_until (for short reservation locks)

7. Appointment

- id (UUID PK)
- slot_id (FK -> timeslot.id) nullable (some systems allow floating appts)
- patient_id (FK)
- clinic_id (FK)
- provider_id (FK)
- service_id (FK)
- status (enum: confirmed,cancelled,rescheduled,checked_in,completed,no_show)
- source (patient,provider,phone,admin)
- created_at, updated_at
- metadata JSON

8. WaitingListEntry

- id (UUID PK)
- clinic_id
- provider_id (optional)
- service_id (optional)
- patient_id
- created_at
- status (waiting,notified,accepted)

9. Notification

- id (UUID PK)
- appointment_id (FK)
- clinic_id
- channel (sms,email,push)
- status (queued,sent,failed)
- attempt_count, last_attempt_at
- payload JSON

10. AuditLog

- id (UUID PK)
- entity_type
- entity_id
- action
- performed_by
- data JSON
- created_at

Indexes & constraints

- Unique constraints on timeslot (provider_id, start_ts) to avoid duplicates
- Index on (`provider_id`, `start_ts`) and (`clinic_id`,`start_ts`) for fast availability queries
- Foreign keys with ON DELETE RESTRICT for historical integrity

Notes on timezones

- All stored timestamps use UTC; `clinic.timezone` used for presentation and slot generation.

Acceptance criteria

- ERD describes relationships and cardinality.
- SQL migration creates tables with PKs, FKs, enums, and indexes.

Next steps

- Apply migration to chosen DB (Postgres recommended).
- Implement slot-generation job that writes `TimeSlot` rows from `ProviderAvailability`.
