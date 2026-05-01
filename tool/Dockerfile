# Stage 1: Install ALL dependencies (including devDependencies needed for build)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Provide dummy env vars so Next.js build doesn't fail on Redis/DB connections
ENV REDIS_HOST=localhost \
    REDIS_PORT=6379 \
    DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy \
    S3_ENDPOINT=http://localhost:9000 \
    S3_ACCESS_KEY=dummy \
    S3_SECRET_KEY=dummy \
    S3_BUCKET=dummy \
    NEXTAUTH_SECRET=build-secret \
    NEXTAUTH_URL=http://localhost:3000
RUN npm run build

# Stage 3: Test (CI only — run via: docker build --target tester .)
FROM node:22-alpine AS tester
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Unit tests only (no DB required); integration tests need a real DB at runtime
CMD ["npm", "run", "test:unit"]

# Stage 4: Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
# Master estimate template (copied from parent repo or mounted as volume)
COPY --from=builder /app/templates ./templates

# Entrypoint: apply migrations then start.
# Three deploy scenarios handled:
#   1. Fresh DB            — 0_init runs (IF NOT EXISTS guards make it safe), then incrementals.
#   2. Existing DB, no history (P3005) — baseline: mark 0_init as applied, then deploy incrementals.
#   3. Existing DB, has history — deploy only unapplied incremental migrations.
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
echo "Enabling pgvector extension..."
echo "CREATE EXTENSION IF NOT EXISTS vector;" | npx prisma db execute --stdin 2>/dev/null || echo "pgvector enable skipped (extension may already exist or require superuser)"

echo "Applying database migrations..."
set +e
DEPLOY_OUT=$(npx prisma migrate deploy 2>&1)
DEPLOY_EXIT=$?
set -e
echo "$DEPLOY_OUT"

if [ $DEPLOY_EXIT -ne 0 ]; then
  if echo "$DEPLOY_OUT" | grep -q "P3005"; then
    echo "Existing schema with no migration history — baselining with 0_init and retrying..."
    npx prisma migrate resolve --applied "0_init"
    npx prisma migrate deploy
  else
    echo "Migration deploy failed (see output above)"
    exit $DEPLOY_EXIT
  fi
fi

echo "Seeding benchmarks (idempotent)..."
npx tsx prisma/seed.ts || echo "Seed failed (non-fatal) — benchmarks can be added via admin UI"
echo "Starting application..."
exec node server.js
EOF
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/entrypoint.sh"]
