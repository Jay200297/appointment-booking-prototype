# Playwright E2E

Quickstart:

1. Install dependencies

```bash
cd e2e
npm install
npm run install-browsers
```

2. Start backend and frontend dev servers:

```bash
# in project/backend-node
npm start

# in project/react-patient-booking
npm run dev
```

3. Run tests

```bash
cd e2e
npm test
```

By default the test expects the frontend at `http://localhost:3000`. Set `FRONTEND_URL` if different.
