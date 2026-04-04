# Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- A domain name with DNS management access
- An SSL certificate (or a platform that provisions one automatically, such as Coolify)
- An AWS account (for RDS, ElastiCache, S3) — or equivalent managed services
- An Anthropic API key
- A Google Cloud project with OAuth 2.0 credentials

---

## Infrastructure Requirements

| Component  | Service               | Minimum Spec                        |
|------------|-----------------------|-------------------------------------|
| Database   | AWS RDS PostgreSQL 16 | db.t3.micro (2 vCPU, 1 GB RAM)      |
| Cache      | AWS ElastiCache Redis 7 | cache.t3.micro (1 vCPU, 0.5 GB) |
| Object storage | AWS S3            | Standard bucket, us-east-1          |
| Compute    | EC2 / ECS / Coolify   | 2 vCPU, 4 GB RAM minimum            |

The app container needs 1 vCPU / 1 GB RAM and the worker container needs 2 vCPU / 2 GB RAM (set in `docker-compose.prod.yml`).

---

## Google OAuth Setup

Before deploying, you need Google OAuth credentials.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Navigate to **APIs & Services** > **OAuth consent screen**.
   - Choose **Internal** if your organisation uses Google Workspace and you want to restrict to company accounts.
   - Fill in the app name, support email, and authorised domain (e.g. `presales.yourcompany.com`).
   - Save.
3. Navigate to **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorised JavaScript origins: `https://presales.yourcompany.com`
   - Authorised redirect URIs: `https://presales.yourcompany.com/api/auth/callback/google`
   - Save and copy the **Client ID** and **Client Secret**.

---

## Environment Configuration

Copy `.env.production.example` to `.env` and populate every value:

```bash
cp .env.production.example .env
```

| Variable               | Required | Description                                                   |
|------------------------|----------|---------------------------------------------------------------|
| `NEXTAUTH_URL`         | Yes      | Public HTTPS URL of the app (e.g. `https://presales.example.com`) |
| `NEXTAUTH_SECRET`      | Yes      | 32-character random string. Generate: `openssl rand -base64 32` |
| `ALLOWED_EMAIL_DOMAIN` | Yes      | Restrict logins to this domain (e.g. `yourcompany.com`)       |
| `NODE_ENV`             | Yes      | Set to `production`                                           |
| `DATABASE_URL`         | Yes      | Full PostgreSQL connection string with `?sslmode=require`     |
| `REDIS_HOST`           | Yes      | ElastiCache primary endpoint hostname                         |
| `REDIS_PORT`           | Yes      | Redis port (default `6379`)                                   |
| `S3_ENDPOINT`          | No       | Leave blank for native AWS S3; set for MinIO or compatible    |
| `S3_ACCESS_KEY`        | Yes      | IAM access key with S3 read/write on the bucket               |
| `S3_SECRET_KEY`        | Yes      | IAM secret access key                                         |
| `S3_BUCKET`            | Yes      | S3 bucket name (must exist before deployment)                 |
| `AWS_REGION`           | Yes      | AWS region (e.g. `us-east-1`)                                 |
| `ANTHROPIC_API_KEY`    | Yes      | Anthropic API key with access to Claude models                |
| `GOOGLE_CLIENT_ID`     | Yes      | From Google Cloud Console OAuth credentials                   |
| `GOOGLE_CLIENT_SECRET` | Yes      | From Google Cloud Console OAuth credentials                   |
| `SLACK_WEBHOOK_URL`    | No       | Incoming webhook URL for phase notifications                  |
| `SMTP_HOST`            | No       | SMTP hostname (e.g. `email-smtp.us-east-1.amazonaws.com`)     |
| `SMTP_PORT`            | No       | `587` (STARTTLS) or `465` (SSL/TLS)                           |
| `SMTP_USER`            | No       | SMTP username / SES SMTP credential                           |
| `SMTP_PASS`            | No       | SMTP password                                                 |
| `SMTP_FROM`            | No       | From address (e.g. `Presales Tool <no-reply@yourcompany.com>`) |
| `SMTP_TO`              | No       | Comma-separated notification recipients                       |
| `SENTRY_DSN`           | No       | Sentry DSN for error tracking                                 |

---

## Database Setup

### Create the RDS Instance

1. In the AWS console, create a PostgreSQL 16 RDS instance.
2. Set the database name to `presales`.
3. Note the endpoint, port, username, and password.
4. Ensure the security group allows inbound on port 5432 from the compute instance or ECS task security group.
5. Construct `DATABASE_URL`:

```
postgresql://<user>:<password>@<endpoint>:5432/presales?sslmode=require
```

### Run Migrations

Migrations must be run once after the first deployment and after any schema change:

```bash
# From inside the running app container
docker exec -it <app-container-name> npx prisma migrate deploy
```

Or as a one-off command before starting the stack:

```bash
docker run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  presales-tool:latest \
  npx prisma migrate deploy
```

### Seed Benchmarks (optional)

If you have benchmark seed data:

```bash
docker exec -it <app-container-name> npx prisma db seed
```

---

## Coolify Deployment (Recommended)

[Coolify](https://coolify.io) is a self-hosted PaaS that handles Docker Compose deployments, SSL provisioning (via Let's Encrypt), and rolling restarts.

### Steps

1. **Create a new resource** in Coolify: **Docker Compose** > paste the contents of `docker-compose.prod.yml`, or point to the Git repository.

2. **Set environment variables** in the Coolify UI under the service's **Environment Variables** tab. Add all variables from the table above.

3. **Configure the domain**: In the Coolify service settings, set the domain to `presales.yourcompany.com`. Coolify will provision an SSL certificate automatically via Let's Encrypt.

4. **Expose port**: Ensure the `app` service port `3000` is mapped to the Coolify proxy (this is the default when a domain is set).

5. **Deploy**: Click **Deploy**. Coolify builds the Docker image, runs the containers, and routes HTTPS traffic to port 3000.

6. **Run migrations** after the first deploy (see Database Setup above).

### Re-deployments

Push to the configured Git branch (or click **Redeploy** in Coolify). Coolify performs a rolling restart: the new image is built, the app container is replaced, and the worker container is restarted.

---

## Manual Docker Deployment

### Build the Image

```bash
docker build -t presales-tool:latest .
```

### Push to a Registry (if using a remote host)

```bash
docker tag presales-tool:latest <registry>/presales-tool:latest
docker push <registry>/presales-tool:latest
```

Update the `image:` field in `docker-compose.prod.yml` to match.

### Start the Stack

```bash
# Copy and populate the env file
cp .env.production.example .env
# edit .env with your values

# Start app + worker
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### Run Migrations

```bash
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### Stop the Stack

```bash
docker compose -f docker-compose.prod.yml down
```

---

## S3 Bucket Setup

1. Create an S3 bucket in your chosen AWS region.
2. Block all public access (the app uses presigned URLs for file access).
3. Create an IAM policy with the following minimum permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::presales-production/*"
    }
  ]
}
```

4. Create an IAM user, attach the policy, and generate access keys.
5. Set `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_BUCKET` in `.env`.
6. Leave `S3_ENDPOINT` blank (empty string) to use native AWS S3.

---

## Post-Deployment Verification

Run through this checklist after every initial deployment:

- [ ] `https://presales.yourcompany.com/api/health` returns `200 OK`
- [ ] Navigating to `https://presales.yourcompany.com` redirects to `/login`
- [ ] Google OAuth sign-in completes and lands on the dashboard
- [ ] Users with a non-allowed email domain are rejected at sign-in
- [ ] Creating an engagement succeeds and appears in the list
- [ ] Triggering Phase 0 enqueues a job (phase status changes to `RUNNING`)
- [ ] SSE stream delivers progress events to the browser (check the phase detail page)
- [ ] Phase completes and status moves to `REVIEW`
- [ ] Slack or email notification is received (if configured)
- [ ] Artefact files are readable in the phase artefact viewer

---

## Monitoring

### Health Check Endpoint

`GET /api/health` — returns `200 { status: "ok" }`. Used by the Docker healthcheck in `docker-compose.prod.yml` (interval 30 s, 3 retries).

### Sentry

1. Create a project at [sentry.io](https://sentry.io) (platform: Next.js).
2. Copy the DSN.
3. Set `SENTRY_DSN=<dsn>` in `.env`.
4. Errors from both the Next.js app and the worker are captured automatically.

### Logs

Containers write structured JSON logs. View with:

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f worker
```

Log rotation is configured in `docker-compose.prod.yml`: max 10 MB per file, 3 files retained.

---

## Backup and Recovery

### Database

Use AWS RDS automated backups:

1. Enable automated backups with a 7-day retention window in the RDS instance settings.
2. For point-in-time recovery, enable the **Backup window** and **Multi-AZ** (recommended for production).
3. To restore: create a new RDS instance from a snapshot, update `DATABASE_URL`, and redeploy.

Manual backup:

```bash
pg_dump \
  --dbname="${DATABASE_URL}" \
  --format=custom \
  --file=presales-$(date +%Y%m%d).pgdump
```

### S3 Artefacts

Enable S3 Versioning on the bucket to retain previous artefact versions. Enable S3 Replication to a second region for disaster recovery (optional but recommended for production).

### Redis

BullMQ job state in Redis is transient. Completed jobs are pruned automatically (`removeOnComplete: 100`, `removeOnFail: 200`). Redis data does not need to be backed up — if lost, in-flight jobs will be re-queued on the next worker start via BullMQ's retry mechanism.

---

## Troubleshooting

### App container exits immediately

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs app
```

Common causes:
- `DATABASE_URL` is wrong or RDS is not reachable (check security group rules).
- `NEXTAUTH_SECRET` is missing.
- Prisma migration has not been run (`PrismaClientInitializationError`).

### Worker is not processing jobs

```bash
docker compose -f docker-compose.prod.yml logs worker
```

Common causes:
- `REDIS_HOST` / `REDIS_PORT` points to an unreachable ElastiCache endpoint.
- `ANTHROPIC_API_KEY` is invalid or has no credit.
- The worker container is not running — verify with `docker compose ps`.

### Google OAuth returns "redirect_uri_mismatch"

The **Authorised redirect URI** in Google Cloud Console must exactly match:

```
https://presales.yourcompany.com/api/auth/callback/google
```

Update the URI in the Google Cloud Console credential and redeploy.

### Sign-in works but user sees "Access Denied"

The user's email domain does not match `ALLOWED_EMAIL_DOMAIN`. Either update the variable or add the user's domain to the allowed list.

### SSE stream never delivers progress

- Ensure the reverse proxy (nginx, Coolify proxy, ALB) does not buffer responses. Set `X-Accel-Buffering: no` header or disable proxy buffering for the SSE route.
- Check that the worker is running and the job was enqueued (inspect BullMQ via a Redis CLI `KEYS bull:*`).

### Presigned S3 URLs return 403

- The IAM user lacks `s3:GetObject` permission on the bucket.
- The `S3_BUCKET` name in `.env` does not match the actual bucket name.
- `AWS_REGION` is set incorrectly — the presigned URL is generated for the wrong region.
