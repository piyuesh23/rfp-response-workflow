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

# Stage 3: Runtime
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
# Master estimate template (copied from parent repo or mounted as volume)
COPY --from=builder /app/templates ./templates

# Entrypoint: push schema then start
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
echo "Running prisma db push..."
npx prisma db push
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
