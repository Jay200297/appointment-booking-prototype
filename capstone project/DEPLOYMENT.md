# Deploying DOCTOR&U — Step by Step

This guide has two parts:

- **Part A** — test the whole app on your own computer with one command (do this first)
- **Part B** — put it live on the internet for free, using one website (Render) for everything

You don't need to know Docker, Postgres, or hosting already — just follow the steps in order.

---

## Part A — Run it on your computer first

### 1. Install Docker Desktop

Download it from https://www.docker.com/products/docker-desktop and install it
(free). Open it once after installing — you'll see a whale icon running in
your system tray/menu bar when it's ready.

### 2. Unzip the project

Unzip `capstone_project_updated.zip` anywhere on your computer, e.g. your Desktop.

### 3. Open a terminal in the project folder

- **Windows:** open the unzipped folder in File Explorer, click the address
  bar, type `cmd`, press Enter
- **Mac:** right-click the unzipped folder → "New Terminal at Folder" (or open
  Terminal and `cd` into it)

### 4. Run one command

```
docker compose up --build
```

The first run takes a few minutes — it downloads Postgres, installs
dependencies, and builds both the backend and frontend. You'll see a lot of
text scroll by. Wait until it settles down and you see something like:

```
backend-1   | Server running on port 8000
frontend-1  | Serving!
```

### 5. Open the app

Go to **http://localhost:8001** in your browser. You should see the
"Appointment Scheduling System" homepage.

Try logging in with one of the built-in demo accounts (password for all of
them is `Password123!`):

| Role | Email |
|---|---|
| Patient | patient@example.com |
| Provider | provider@example.com |
| Admin | admin@example.com |

### 6. Stop it when you're done

In the terminal, press `Ctrl+C`, then run:
```
docker compose down
```

Your data is saved and will still be there next time you run `docker compose up --build`.

**If something doesn't work**, run `docker compose logs backend` (or `frontend`,
or `db`) to see what went wrong, and feel free to paste the error back to me.

---

## Part B — Put it live on the internet (free)

We'll use **Render** (render.com) for everything — your database, your
backend, and your frontend — so you only need one account.

### 1. Put your code on GitHub

Render deploys from a GitHub repository, so your code needs to live there first.

1. Go to https://github.com and create a free account if you don't have one
2. Click the **+** in the top right → **New repository**. Name it something
   like `doctor-and-u`. Leave it empty (no README). Click **Create repository**
3. On your computer, open a terminal in the project folder and run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/doctor-and-u.git
   git push -u origin main
   ```
   (Replace `YOUR-USERNAME` with your actual GitHub username — GitHub shows
   you this exact command on the empty repo page too.)

### 2. Create the database

1. Go to https://render.com and sign up (you can sign up with your GitHub account)
2. Click **New +** → **PostgreSQL**
3. Give it a name like `doctor-and-u-db`, choose the **Free** plan, click **Create Database**
4. Wait for it to say "Available" (~1 minute)
5. Scroll down and copy the **Internal Database URL** — you'll need it in step 3

### 3. Run your migrations against the new database

1. On the database page, click **Connect** → copy the **PSQL Command** (or
   use the "External Database URL" if you're running this from your own
   computer rather than Render's shell)
2. On your computer, in the project folder, run each migration file in order
   against that connection string, for example:
   ```
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/001_create_schema.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/002_seed_data.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/003_create_users.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/004_seed_users.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/005_create_clinic_provider.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/006_add_clinic_geo.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/007_seed_real_clinics.sql
   psql "YOUR_EXTERNAL_DATABASE_URL" -f migrations/008_fix_notification_table.sql
   ```
   (Don't have `psql` installed locally? Install PostgreSQL from
   https://www.postgresql.org/download/ — it comes with `psql`.)
3. **Skip the demo accounts in production if you want** — migration `004`
   creates the `patient@example.com` / `provider@example.com` /
   `admin@example.com` demo logins with a public password. It's fine for
   testing, but before real patients use this, either skip that file or
   delete those rows afterward.

### 4. Deploy the backend

1. On Render, click **New +** → **Web Service**
2. Connect your GitHub account and pick your `doctor-and-u` repository
3. Fill in:
   - **Name:** `doctor-and-u-backend`
   - **Root Directory:** `backend-node`
   - **Runtime:** Docker (Render will detect the `Dockerfile` automatically)
   - **Plan:** Free
4. Scroll to **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Internal Database URL from step 2 |
   | `DATABASE_SSL` | `true` |
   | `JWT_SECRET` | a long random string — generate one below |
   | `JWT_EXPIRY` | `1h` |
   | `FRONTEND_URL` | leave blank for now, you'll fill this in after step 5 |
   | `ENABLE_REMINDER_SCHEDULER` | `false` |

   To generate a real `JWT_SECRET`, run this on your computer and paste the result:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
5. Click **Create Web Service**. Wait for it to build and deploy (~2–5 minutes)
6. Once live, copy its URL at the top of the page — it looks like
   `https://doctor-and-u-backend.onrender.com`

### 5. Deploy the frontend

You have two good free options here. **Vercel** is a great choice — pick this
if you already want to use Vercel. Render's static sites work just as well
if you'd rather keep everything on one dashboard. Do only ONE of these two.

#### Option 1: Vercel (recommended if you're already using Vercel)

1. Go to https://vercel.com and sign up (you can sign up with your GitHub account)
2. Click **Add New...** → **Project**
3. Find and import your `doctor-and-u` repository
4. Vercel will auto-detect it's a Vite app. Set:
   - **Root Directory:** click **Edit** next to it and select `react-patient-booking`
   - **Framework Preset:** Vite (should auto-select)
   - **Build Command:** `npm run build` (default is fine)
   - **Output Directory:** `dist` (default is fine)
5. Open **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE` | the backend URL from step 4.6, e.g. `https://doctor-and-u-backend.onrender.com` |

6. Click **Deploy**. Wait ~1–2 minutes
7. Once done, copy your live URL — it looks like `https://doctor-and-u.vercel.app`

**Important:** if you ever change `VITE_API_BASE` later (e.g. you rename your
backend), you must **redeploy** on Vercel afterward — unlike a normal backend
env var, this one gets baked into the built JavaScript file at build time, so
just editing it in the dashboard isn't enough. Go to **Deployments** → click
the **⋯** menu on the latest deployment → **Redeploy**.

#### Option 2: Render Static Site

1. On Render, click **New +** → **Static Site**
2. Pick the same `doctor-and-u` repository
3. Fill in:
   - **Name:** `doctor-and-u`
   - **Root Directory:** `react-patient-booking`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Add an environment variable:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE` | the backend URL from step 4.6, e.g. `https://doctor-and-u-backend.onrender.com` |

5. Click **Create Static Site**. Wait for it to build (~1–2 minutes)
6. Copy its URL, e.g. `https://doctor-and-u.onrender.com`

### 6. Connect the two

1. Go back to your backend service → **Environment**
2. Set `FRONTEND_URL` to the frontend URL you copied in step 5

   **If you used Vercel:** use your stable production URL — the one
   without a random hash or branch name in it (e.g.
   `https://doctor-and-u.vercel.app`, found under your project's
   **Domains** tab). Your backend only trusts one exact URL at a time, and
   Vercel creates a new unique "preview" URL every time you push a code
   change — those previews won't be able to reach your backend, but your
   main production site always will.
3. Click **Save Changes** — the backend will restart automatically

### 7. Try it live

Visit your frontend URL (e.g. `https://doctor-and-u.onrender.com`) — your app
is now live on the internet, for free.

**One thing to know about the free tier:** free Render web services "sleep"
after 15 minutes of no traffic, and take ~30–60 seconds to wake back up on
the next visit. This is completely normal on the free plan and not a bug —
if you outgrow it later, Render's paid tier removes the sleep delay.

---

## Quick reference: what each file/folder is for

- `docker-compose.yml` — runs the whole app locally with one command (Part A)
- `migrations/` — database setup, run once per environment, in order
- `backend-node/` — the API server (Node/Express)
- `react-patient-booking/` — the website (React)
- `.env` (project root) — used only by `docker compose up` for local testing;
  not used in production, where you set env vars directly on Render instead

If you get stuck on any step, paste me the exact error message and I'll help
you work through it.
