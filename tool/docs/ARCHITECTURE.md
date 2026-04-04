# Architecture

## Overview

The Presales Tool is a Next.js 15 application that orchestrates multi-phase AI analysis of pre-sales engagement documents. It uses a background worker pattern to execute long-running Claude agent tasks without blocking HTTP requests.

```
                          +------------------+
                          |     Browser      |
                          | (Next.js App     |
                          |  Router + SSE)   |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |   Next.js App    |
                          |  (API Routes +   |
                          |  Server Actions) |
                          +---+----------+---+
                              |          |
               +--------------+          +--------------+
               |                                        |
    +----------v-----------+               +-----------v----------+
    |     BullMQ Queue     |               |      PostgreSQL       |
    |      (Redis)         |               |  (Prisma ORM)        |
    +----------+-----------+               +----------------------+
               |
    +----------v-----------+               +----------------------+
    |   BullMQ Worker      +-------------->|    S3 / MinIO        |
    |  (phase-runner.ts)   |               |  (Artefact Storage)  |
    +----------+-----------+               +----------------------+
               |
    +----------v-----------+
    |  Claude Agent SDK    |
    |  (Anthropic API)     |
    +----------+-----------+
               |
    +----------v-----------+
    |  Phase Configs       |
    |  (Phase 0–5 prompts  |
    |   + tool definitions)|
    +----------------------+
```

**Data stores:**

| Store      | Dev (docker-compose.yml) | Production        |
|------------|--------------------------|-------------------|
| PostgreSQL | Local container (pg 16)  | AWS RDS pg 16     |
| Redis      | Local container (r7)     | AWS ElastiCache   |
| Object     | MinIO container          | AWS S3            |

---

## Application Layers

### Frontend — App Router + shadcn/ui

Located under `src/app/`. Uses Next.js 15 App Router with React Server Components for data-fetching and Client Components for interactive controls. UI components are from shadcn/ui (Radix primitives + Tailwind CSS).

Key pages:

- `/` — Dashboard, engagement list
- `/engagements/[id]` — Engagement detail with phase status and artefact viewer
- `/login` — Google OAuth sign-in page

Real-time phase progress is delivered through Server-Sent Events (SSE) polled from `/api/engagements/[id]/phases/[phaseId]/stream`.

### API — Route Handlers

Located under `src/app/api/`. All routes under `/api/*` are protected by `src/middleware.ts`. Fine-grained role checks happen inside individual handlers using `requireRole()` from `src/lib/rbac.ts`.

Key routes:

- `POST /api/engagements` — Create engagement
- `POST /api/engagements/[id]/phases/[phaseId]/run` — Enqueue phase job
- `GET  /api/engagements/[id]/phases/[phaseId]/stream` — SSE progress stream
- `POST /api/engagements/[id]/phases/[phaseId]/approve` — Approve phase output
- `GET  /api/health` — Health check (used by Docker healthcheck)

### AI Orchestration — Agent SDK Wrapper

Located under `src/lib/ai/`.

- `agent.ts` — Exports `runPhase()`, an async generator that streams `ProgressEvent` objects. Handles workspace directory setup via `prepareWorkDir()`. Wraps the Claude Agent SDK with per-phase configuration.
- `phases/index.ts` — Phase registry: maps phase number strings (`"0"`, `"1"`, `"1A"`, `"1A-proposal"`, `"2"`, `"3"`, `"4"`, `"5"`) to `PhaseConfig` objects.
- `phases/phase*.ts` — One file per phase; each exports a `get*Config()` function returning a `PhaseConfig` with `systemPrompt`, `userPrompt`, `tools`, and `maxTurns`.

`PhaseConfig` structure:

```typescript
interface PhaseConfig {
  engagementId: string;
  phase: number;
  techStack: string;
  tools: string[];      // tool names available to the agent
  maxTurns: number;
  systemPrompt: string;
  userPrompt: string;
}
```

### Background Jobs — BullMQ Worker

`src/workers/phase-runner.ts` runs as a separate process (`node dist/workers/phase-runner.js`). It:

1. Picks jobs from the `phase-execution` BullMQ queue (concurrency: 3).
2. Updates the `Phase` record to `RUNNING`.
3. Calls `runPhase()` and forwards each `ProgressEvent` to `job.updateProgress()`.
4. On success: sets status to `REVIEW` and fires a notification.
5. On failure: sets status to `FAILED`, fires an error notification, and re-throws so BullMQ can retry (max 3 attempts, exponential backoff starting at 5 s).

The queue is defined in `src/lib/queue.ts` with:

- `attempts: 3`
- `backoff: { type: "exponential", delay: 5000 }`
- `removeOnComplete: 100` / `removeOnFail: 200`

### Storage — S3 / MinIO

`src/lib/storage.ts` wraps the AWS SDK v3 S3 client. The same code runs against local MinIO (development) and AWS S3 (production) — the only difference is the `S3_ENDPOINT` variable (empty = native AWS S3).

Functions: `uploadFile`, `downloadFile`, `deleteFile`, `getPresignedUrl`.

File keys follow the pattern `engagements/{engagementId}/{directory}/{filename}`.

---

## Data Flow

A full engagement runs through these steps:

```
1.  User uploads TOR document via the UI
        -> API stores file in S3 under engagements/{id}/tor/
        -> Creates Engagement record in PostgreSQL (status: DRAFT)

2.  User triggers Phase 0 (Customer Research)
        -> API creates Phase record (status: PENDING)
        -> Enqueues PhaseJobData onto BullMQ queue
        -> Returns 202 Accepted

3.  Worker picks up the job
        -> Sets Phase status: RUNNING
        -> getPhaseConfig("0", techStack, engagementId) returns Phase 0 prompt + tools
        -> runPhase() starts Claude agent session
        -> Agent uses tools (WebSearch, WebFetch, Read, Write) to research the customer
        -> Each tool call emits a ProgressEvent -> job.updateProgress()
        -> Frontend receives progress via SSE stream

4.  Phase 0 completes
        -> Agent writes artefacts to /data/engagements/{id}/research/
        -> Worker sets Phase status: REVIEW
        -> Sends Slack + email notification: "Review Needed"

5.  Reviewer approves Phase 0 output
        -> PATCH /api/.../approve sets Phase status: APPROVED
        -> UI unlocks Phase 1 trigger

6.  Phases 1 -> 1A -> 2 -> 3 -> 4 -> 5 follow the same pattern
        -> Each phase reads prior phase artefacts from the work directory
        -> Phase 1A (optimistic estimate) can run without customer responses
        -> Revision feedback from the reviewer is appended to the userPrompt before re-run

7.  Phase 5 (Knowledge Capture)
        -> Agent stores learnings in claude-mem MCP
        -> Updates Benchmark records in PostgreSQL
```

---

## AI Agent Architecture

Each phase is an independent agent invocation with a focused persona and tool set.

| Phase | Persona                       | Key Tools                                      | Primary Output                        |
|-------|-------------------------------|------------------------------------------------|---------------------------------------|
| 0     | Senior Technical Architect    | WebSearch, WebFetch, Write                     | customer-research.md + CSV exports    |
| 1     | Senior Requirements Analyst   | Read, Write, sequential-thinking               | tor-assessment.md, questions.md       |
| 1A    | Senior Architect (optimistic) | Read, Write, Bash (xlsx script)                | optimistic-estimate.md, proposal.md   |
| 2     | Senior Architect              | Read, Write                                    | response-analysis.md                  |
| 3     | Architect + Estimation Lead   | Read, Write, ralph-loop                        | estimate-review.md                    |
| 4     | Estimation Specialist         | Read, Write                                    | gap-analysis.md, revised-estimates.md |
| 5     | Knowledge Engineer            | claude-mem store/retrieve                      | Benchmark records, mem observations   |

Revision feedback (from the Phase review gate) is injected at the end of `userPrompt` before the agent session starts, enabling iterative refinement without prompt-engineering changes.

CARL presales domain rules are loaded as part of each phase's `systemPrompt` to enforce estimation quality gates on every run.

---

## Authentication and Authorization

### Authentication — NextAuth + Google OAuth

Configured in `src/lib/auth.ts`. Sign-in flow:

1. User hits `/login` and clicks "Sign in with Google".
2. NextAuth redirects to Google OAuth consent.
3. On callback, the `signIn` callback validates the email domain against `ALLOWED_EMAIL_DOMAIN`. Non-matching domains are rejected.
4. If valid, the user is upserted into the `User` table with `lastLoginAt` updated.
5. The `session` callback enriches the session token with `id` and `role` from the database.

New users default to the `MANAGER` role. Roles are only changed by an `ADMIN` through the settings UI.

### Authorization — RBAC

Defined in `src/lib/rbac.ts`. Three roles with additive permissions:

| Permission           | VIEWER | MANAGER | ADMIN |
|----------------------|--------|---------|-------|
| Read engagements     | yes    | yes     | yes   |
| Read phases/artefacts| yes    | yes     | yes   |
| Create engagement    |        | yes     | yes   |
| Edit engagement      |        | yes     | yes   |
| Delete engagement    |        | yes     | yes   |
| Run phase            |        | yes     | yes   |
| Approve phase        |        | yes     | yes   |
| Edit estimate        |        | yes     | yes   |
| Manage users         |        |         | yes   |

`requireRole(session, ...roles)` is called inside API route handlers and throws a `FORBIDDEN` error if the user's role is not in the allowed list.

### Route Protection — Middleware

`src/middleware.ts` uses `next-auth/middleware` (`withAuth`) to protect all routes matching:

```
/engagements/:path*
/settings/:path*
/api/:path*
```

- Unauthenticated browser requests are redirected to `/login`.
- Unauthenticated API requests receive `401 { error: "Unauthorized" }`.
- Role enforcement is deferred to individual route handlers.

---

## Real-time Updates — SSE

Phase execution can run for several minutes. Rather than polling, the frontend subscribes to a Server-Sent Events stream:

```
GET /api/engagements/[id]/phases/[phaseId]/stream
```

The route handler reads `job.progress` from BullMQ via the `QueueEvents` listener and forwards each `ProgressEvent` as an SSE `data:` frame. The connection closes when the job reaches a terminal state (`complete` or `error`).

**Why SSE over WebSocket:** SSE is unidirectional (server to client), works over standard HTTP/2, requires no upgrade handshake, and integrates naturally with Next.js route handlers. WebSocket would require a separate server process or a third-party service. Phase progress is purely server-to-client, so SSE is a natural fit.

---

## Data Model

Full schema at `prisma/schema.prisma`. Key relationships:

```
User 1──* Engagement
Engagement 1──* Phase
Engagement 1──* Assumption
Engagement 1──* RiskRegisterEntry
Phase 1──* PhaseArtefact
Benchmark (standalone — indexed by techStack + category)
```

Notable design choices:

- `Phase.phaseNumber` is a `String` (not `Int`) to support labels like `"1A"` and `"1A-proposal"`.
- `PhaseArtefact.contentMd` stores markdown inline for fast rendering; `fileUrl` stores the S3 key for binary files (Excel, PDFs).
- `Assumption.torReference` and `impactIfWrong` are mandatory fields enforcing the assumption-sourcing feedback rule.
- `RiskRegisterEntry.conf` mirrors the Conf (1–6) scoring system from the estimation rules.

---

## Key Design Decisions

### Why Anthropic Agent SDK over raw API calls

The Agent SDK manages multi-turn tool-use loops automatically. Phase prompts can invoke tools (Read, Write, WebSearch, etc.) across many turns without custom orchestration code. The SDK also handles token budgeting, error recovery, and streaming natively.

### Why BullMQ

Phase execution takes 2–15 minutes per run. Keeping this in an HTTP request would exhaust server timeouts and prevent retries. BullMQ provides:

- Persistent job state in Redis (survives worker restarts)
- Built-in retry with exponential backoff
- Concurrency control (3 simultaneous phases)
- Job progress events consumed by the SSE stream

### Why SSE over WebSocket

Covered in the Real-time Updates section above. SSE requires no infrastructure changes and maps cleanly to Next.js route handlers.

### Why MinIO in development

MinIO is S3-compatible. The same `storage.ts` code runs against MinIO locally and AWS S3 in production, controlled entirely by environment variables. This eliminates local/production divergence in file handling.

### Why a single Docker image for app and worker

The worker and app share the same codebase and compiled output. Using one image simplifies the build pipeline and ensures the worker always runs the same code version as the app. The entry point is overridden in `docker-compose.prod.yml` (`command: node dist/workers/phase-runner.js`).
