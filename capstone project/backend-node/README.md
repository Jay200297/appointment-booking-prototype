Node/Express backend for Appointment Booking Prototype

Features included

- JWT authentication + RBAC
- Request validation
- Swagger/OpenAPI docs at `/docs`
- Automated tests for auth, validation, and route behavior

Quickstart

1. Install deps:

```bash
cd backend-node
npm install
```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `PORT`.

3. Run Postgres migrations from the root project:

```bash
psql $DATABASE_URL -f ../migrations/001_create_schema.sql
psql $DATABASE_URL -f ../migrations/002_seed_data.sql
```

4. Run dev server:

```bash
npm run dev
```

Authentication

Login endpoint:

```bash
POST /auth/login
{
  "email": "patient@example.com",
  "role": "patient"
}
```

Use the returned token as:

```http
Authorization: Bearer <token>
```

Endpoints

- `GET /availability?clinic_id=&provider_id=&start=&end=` — available timeslots
- `POST /appointments` — body: `{ "timeslot_id": "<id>", "patient": {"first_name","last_name","email","phone"} }`
- `GET /docs` — Swagger UI

Testing

```bash
npm test
```
