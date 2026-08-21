# React Patient Booking UI

This is a minimal React version of the patient booking flow for the clinic appointment platform.

## Run locally

1. Install dependencies:

```bash
cd react-patient-booking
npm install
```

2. Start the backend from the Node API project:

```bash
cd ../backend-node
npm install
npm run dev
```

3. Start the React app:

```bash
cd ../react-patient-booking
npm run dev
```

4. Open the URL shown by Vite (usually `http://localhost:3000`).

## Included flow

- Login using JWT auth
- View available slots for a selected date
- Select a slot
- Enter patient details
- Submit booking to `/appointments`

## Notes

- The app expects the backend to be running on `http://localhost:8000`.
- Seed values are matched to the clinic/provider IDs in the database migration.
