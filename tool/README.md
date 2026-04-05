# QED42 Presales Estimation Tool

An internal AI-powered tool for presales managers to generate effort estimates from Terms of Reference (TOR) documents. The tool orchestrates a multi-phase workflow — from customer research through gap analysis — using Claude as the underlying AI engine, with structured artefacts, confidence-scored estimates, and Excel export at each stage.

---

## Features

- TOR document upload and storage via S3/MinIO
- AI-powered TOR analysis with requirement clarity assessment
- Multi-phase workflow: Research, Analysis, Optimistic Estimate, Response Integration, Review, Gap Analysis
- Tabbed estimates (Backend / Frontend / Fixed Cost Items / AI) matching QED42 Excel template structure
- Confidence scoring (Conf 1-6) with automatic low/high hour calculation per line item
- Risk register auto-generated for all Conf 4 and below items
- Assumption tracking with TOR references and impact-if-wrong statements
- Excel export via ExcelJS
- Technical proposal generation
- Benchmark management for effort calibration across engagements
- Role-based access control (Admin / Manager / Viewer)
- Real-time phase progress via Server-Sent Events (SSE)
- Slack and email notifications
- Google OAuth with domain-restricted sign-in

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Base UI) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL 16 |
| Job Queue | BullMQ 5 + Redis 7 |
| File Storage | AWS S3 / MinIO |
| Auth | NextAuth v4 (Google OAuth) |
| AI | Anthropic Claude (via Claude Agent SDK) |
| Excel | ExcelJS |
| Email | Nodemailer |
| Language | TypeScript 5 |

---

## Prerequisites

- Node.js 22 or higher
- Docker and Docker Compose
- Anthropic API key
- Google OAuth credentials (Client ID + Secret)

---

## Quick Start (Local Development)

Run infrastructure services with Docker, then run the Next.js app directly with Node.

```bash
# 1. Clone the repository and enter the tool directory
git clone <repo-url>
cd tool/

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env and fill in the required values (see Environment Variables below)

# 3. Start infrastructure services
docker compose up -d postgres redis minio

# 4. Install dependencies
npm install

# 5. Generate Prisma client
npx prisma generate

# 6. Push schema to database
npx prisma db push

# 7. Seed reference data
npx prisma db seed

# 8. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The background worker (phase runner) must also be running for AI phases to execute:

```bash
# In a separate terminal
npx tsx src/workers/phase-runner.ts
```

---

## Docker Development (Full Stack)

Runs the app, worker, and all infrastructure as containers.

```bash
# Requires ANTHROPIC_API_KEY, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID,
# GOOGLE_CLIENT_SECRET set in your shell environment or a .env file
docker compose up
```

All services start together: `app`, `worker`, `postgres`, `redis`, `minio`.

MinIO console is available at [http://localhost:9001](http://localhost:9001) (user: `minioadmin`, password: `minioadmin`).

---

## Project Structure

```
src/
  app/
    api/
      artefacts/[id]/     # Fetch/update individual artefacts
      auth/               # NextAuth route handler
      engagements/        # CRUD for engagements
      export/excel/       # Excel export endpoint
      phases/[id]/
        approve/          # Approve a phase
        revise/           # Request revision
        run/              # Trigger AI phase execution
        sse/              # Real-time progress stream
      upload/             # TOR file upload
    engagements/
      new/                # New engagement form
      [id]/               # Engagement detail and phase management
    login/                # Google OAuth sign-in page
    settings/             # Admin settings
  components/
    artefact/             # Artefact viewer and editor
    assumption/           # Assumption list and tracking
    engagement/           # Engagement cards and forms
    estimate/             # Estimate table with Conf scoring
    layout/               # Shell, sidebar, header
    phase/                # Phase stepper and status
    risk/                 # Risk register display
    ui/                   # shadcn/ui primitives (button, card, table, etc.)
  lib/
    ai/                   # Claude agent integration and phase prompts
    auth.ts               # NextAuth config
    auth-guard.ts         # Server-side role checks
    db.ts                 # Prisma client singleton
    excel-export.ts       # ExcelJS workbook generation
    notifications.ts      # Slack + email notification helpers
    phase-chain.ts        # Phase orchestration logic
    queue.ts              # BullMQ queue and job definitions
    rbac.ts               # Role-based access control helpers
    storage.ts            # S3/MinIO upload and presigned URL helpers
    utils.ts              # Shared utilities (cn, date formatting, etc.)
  workers/
    phase-runner.ts       # BullMQ worker — processes AI phase jobs
```

---

## Workflow Phases

| Phase | Name | Description |
|---|---|---|
| 0 | Customer Research | Web research on the client, site audit (tech stack, CWV, integrations, hidden scope) |
| 1 | TOR Analysis | Requirement clarity assessment and structured clarifying question generation |
| 1A | Optimistic Estimate | Assumption-based estimates using lowest-effort options; no customer responses required |
| 2 | Response Integration | Maps customer Q&A answers back to requirements; updates clarity assessment |
| 3 | Estimate Review | Validates estimates against TOR and responses: coverage, effort reasonableness, consistency |
| 4 | Gap Analysis | Full requirement-to-line-item traceability map; revised estimates where gaps found |
| 5 | Knowledge Capture | Records learnings and actual vs estimated variances into benchmark store |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `NEXTAUTH_SECRET` | Yes | Random 32-character string for session signing |
| `NEXTAUTH_URL` | Yes | Public base URL of the app (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | Yes | Redis hostname (default: `localhost`) |
| `REDIS_PORT` | Yes | Redis port (default: `6379`) |
| `S3_ENDPOINT` | Yes | S3-compatible endpoint URL (MinIO: `http://localhost:9000`) |
| `S3_ACCESS_KEY` | Yes | S3 access key |
| `S3_SECRET_KEY` | Yes | S3 secret key |
| `S3_BUCKET` | Yes | S3 bucket name (default: `presales`) |
| `ALLOWED_EMAIL_DOMAIN` | No | Restrict sign-in to this domain (default: `qed42.com`) |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook URL for phase notifications |
| `SMTP_HOST` | No | SMTP server hostname for email notifications |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |

### How to Obtain Each Variable

#### `ANTHROPIC_API_KEY`
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to **API Keys** in the left sidebar
4. Click **Create Key**, give it a name, and copy the generated key

#### `NEXTAUTH_SECRET`
Generate a random 32-character secret using:
```bash
openssl rand -base64 32
```

#### `NEXTAUTH_URL`
Set to the base URL where the app is accessible:
- Local development: `http://localhost:3000`
- Production: your deployed domain (e.g. `https://presales.qed42.com`)

#### `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application** as the application type
6. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
7. Click **Create** and copy the Client ID and Client Secret
8. If prompted, configure the **OAuth consent screen** first (set to **Internal** for organization-only access)

#### `DATABASE_URL`
PostgreSQL connection string in the format:
```
postgresql://<user>:<password>@<host>:<port>/<database>
```
- Using Docker Compose (default): `postgresql://postgres:postgres@localhost:5432/presales`
- For managed PostgreSQL (e.g. AWS RDS, Supabase), use the connection string provided by the service

#### `REDIS_HOST` and `REDIS_PORT`
- Using Docker Compose (default): `REDIS_HOST=localhost`, `REDIS_PORT=6379`
- For managed Redis (e.g. AWS ElastiCache, Upstash), use the host and port provided by the service

#### `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_BUCKET`

**Using MinIO (local development):**
- `S3_ENDPOINT=http://localhost:9000`
- `S3_ACCESS_KEY=minioadmin`
- `S3_SECRET_KEY=minioadmin`
- `S3_BUCKET=presales`

The bucket is auto-created by MinIO. Access the MinIO console at `http://localhost:9001` to manage buckets and objects.

**Using AWS S3 (production):**
1. Go to [AWS Console > S3](https://console.aws.amazon.com/s3/)
2. Create a bucket (e.g. `presales-tor-uploads`)
3. Go to **IAM > Users**, create a user with `AmazonS3FullAccess` (or a scoped policy for the bucket)
4. Create an access key for the user and copy the Access Key ID and Secret Access Key
5. Set `S3_ENDPOINT=https://s3.<region>.amazonaws.com`

#### `ALLOWED_EMAIL_DOMAIN` (optional)
Set to your organization's email domain to restrict Google OAuth sign-in (e.g. `qed42.com`). Omit or leave blank to allow any Google account.

#### `SLACK_WEBHOOK_URL` (optional)
1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app (or select an existing one)
2. Navigate to **Incoming Webhooks** and activate them
3. Click **Add New Webhook to Workspace** and select the target channel
4. Copy the generated webhook URL

#### `SMTP_HOST` (optional)
Set to your SMTP server hostname for email notifications:
- Gmail: `smtp.gmail.com`
- AWS SES: `email-smtp.<region>.amazonaws.com`
- Mailgun: `smtp.mailgun.org`

Additional SMTP configuration (port, user, password) should be set in `.env` as needed.

#### `SENTRY_DSN` (optional)
1. Go to [sentry.io](https://sentry.io/) and sign in
2. Create a new project (select **Next.js** as the platform)
3. Copy the DSN from the project settings under **Client Keys (DSN)**

---

## Available Scripts

```bash
npm run dev        # Start Next.js development server (with hot reload)
npm run build      # Production build
npm run start      # Start production server (requires build)
npm run lint       # Run ESLint

npx prisma generate     # Regenerate Prisma client after schema changes
npx prisma db push      # Push schema changes to database (development)
npx prisma migrate dev  # Create and apply a migration (staging/production)
npx prisma db seed      # Seed reference/benchmark data
npx prisma studio       # Open Prisma Studio (database browser)
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/engagements` | List all engagements / create new engagement |
| `GET/PATCH/DELETE` | `/api/engagements/[id]` | Fetch, update, or delete a single engagement |
| `POST` | `/api/phases/[id]/run` | Enqueue AI phase execution job |
| `POST` | `/api/phases/[id]/approve` | Approve a completed phase |
| `POST` | `/api/phases/[id]/revise` | Request revision of a phase |
| `GET` | `/api/phases/[id]/sse` | SSE stream for real-time phase progress |
| `GET/PATCH` | `/api/artefacts/[id]` | Fetch or update a phase artefact |
| `POST` | `/api/upload` | Upload a TOR document to S3 |
| `POST` | `/api/export/excel` | Generate and download the populated Excel estimate |
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth authentication handlers |

---

## Contributing

This is an internal QED42 tool. Changes should be made on a feature branch and reviewed before merging to `master`.

- Match the existing TypeScript and Tailwind patterns in `src/`
- Keep Prisma schema changes backwards-compatible where possible; create migrations with `prisma migrate dev`
- Test phase execution end-to-end in a local Docker environment before raising a PR
- Do not commit `.env` files or API keys
