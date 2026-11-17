# Beep Assignment — Backend (Launchpad API & Cron)

Standalone Node.js/TypeScript backend for Launchpad: a platform providing job ingestion, automated ATS scraping, Supabase integration, resume evaluation, and scheduled daily background scraping via Vercel Cron.

---

## Features

- **Automated Ingestion Pipeline**: Ingestion service that polls and extracts job feeds from supported ATS platforms (Greenhouse, Lever, etc.).
- **Vercel Cron Handler (`/api/cron`)**: Automated daily pipeline execution triggered securely by Vercel Cron using `GET` and authenticated via `CRON_SECRET`.
- **Manual Ingestion Trigger**: Direct ingestion execution with manual parameters via `POST /api/cron`.
- **CORS Configured**: Secure API endpoints for communication with the frontend application.
- **Supabase Integration**: Direct database interactions with connection resilience, RLS support, and raw payload isolation.

---

## Tech Stack

- **Runtime**: Node.js 20.x, TypeScript (ES2022 / NodeNext)
- **Deployment Platform**: Vercel Serverless Functions (`@vercel/node`)
- **Database**: Supabase PostgreSQL (`@supabase/supabase-js`)
- **Data Validation**: Zod
- **Sanitization & Parsing**: `sanitize-html`, `html-entities`

---

## Getting Started Locally

### 1. Prerequisites

- Node.js 20.x or higher
- npm (or pnpm / yarn)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables:

```ini
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Cron Secret (Vercel Cron Authentication)
CRON_SECRET=your-random-cron-secret-key

# Frontend URL (For CORS whitelist)
FRONTEND_URL=https://beep-assignment-frontend.vercel.app

# Environment
NODE_ENV=production
```

### 4. Build & Verify

```bash
npm run typecheck
npm run build
```

This compiles TypeScript source code into `./dist`.

---

## Serverless Routes (`api/`)

- `GET /api/cron` — Triggered automatically by Vercel Cron. Requires `Authorization: Bearer <CRON_SECRET>`.
- `POST /api/cron` — Manual ingestion trigger. Requires `Authorization: Bearer <CRON_SECRET>`.

---

## Deploying to Vercel

1. Import `beep-assignment-backend` into Vercel.
2. Configure the environment variables in Vercel Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
   - `FRONTEND_URL` (URL of your deployed frontend)
   - `NODE_ENV=production`
3. Click **Deploy**.
4. The cron schedule defined in `vercel.json` will automatically register with Vercel Cron (`0 10 * * *` - Daily at 10:00 UTC).
