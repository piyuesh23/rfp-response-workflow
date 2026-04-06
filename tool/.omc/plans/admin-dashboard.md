# Plan: Admin Dashboard & Platform Management

## Overview

Add an admin-only section to RFP Copilot with user management, analytics, cost tracking, benchmark editing, and prompt management. Admin routes gated by `UserRole.ADMIN`.

---

## Module 1: User & Role Management

### Schema Changes (`prisma/schema.prisma`)
- Add `isBlocked Boolean @default(false)` to User model
- Add `blockedAt DateTime?` and `blockedBy String?` fields

### API Endpoints
- `GET /api/admin/users` — List all users with engagement count, last login, role
- `PATCH /api/admin/users/[id]` — Update role, block/unblock
- All admin endpoints check `session.user.role === "ADMIN"`, return 403 otherwise

### UI Pages
- `/admin/users` — Table: Name, Email, Role (dropdown), Engagements count, Last Login, Status (Active/Blocked), Actions
- Role change: inline Select dropdown, saves on change
- Block/unblock: toggle button with confirmation

### Middleware
- Add auth check in `src/lib/auth.ts` callbacks: if `user.isBlocked`, deny session
- Add `requireAdmin()` helper for admin API routes

### Acceptance Criteria
- [ ] Admin can view all users with their engagement counts
- [ ] Admin can change a user's role (ADMIN/MANAGER/VIEWER)
- [ ] Admin can block a user; blocked user cannot log in
- [ ] Non-admin users get 403 on all `/api/admin/*` routes
- [ ] Sidebar shows "Admin" link only for ADMIN role users

---

## Module 2: All Engagements View

### API Endpoints
- `GET /api/admin/engagements` — All engagements across all users, with creator name, phase progress, workflow path, dates

### UI Pages
- `/admin/engagements` — Table: Client Name, Created By, Tech Stack, Workflow, Phase Progress, Status, Created, Updated
- Filterable by: creator, status, tech stack, workflow path
- Click to navigate to engagement detail (read-only for non-owner admins)

### Acceptance Criteria
- [ ] Admin sees all engagements from all users
- [ ] Table shows creator name and engagement metadata
- [ ] Filters work for creator, status, tech stack

---

## Module 3: Analytics & Metrics Dashboard

### Schema Changes
- Create `PhaseExecution` model:
  ```
  id, phaseId, engagementId, userId, phaseNumber,
  startedAt, completedAt, durationMs,
  inputTokens, outputTokens, totalTokens,
  modelId, estimatedCostUsd,
  apiCallCount, turnCount,
  status (COMPLETED/FAILED/TIMEOUT)
  ```

### Data Collection (agent.ts + phase-runner.ts)
- After each `stream.finalMessage()`, extract `response.usage.input_tokens` and `response.usage.output_tokens`
- Accumulate per-phase totals across all turns in the agentic loop
- On phase completion, write `PhaseExecution` record with totals
- Model pricing map: `{ "claude-opus-4-20250514": { input: 15, output: 75 }, "claude-sonnet-4-20250514": { input: 3, output: 15 } }` (per 1M tokens)

### API Endpoints
- `GET /api/admin/analytics` — Aggregated stats:
  - Total engagements, phases run, tokens consumed, estimated cost
  - By user: engagement count, phases run, total cost
  - By phase type: avg duration, avg tokens, avg cost, success rate
  - Time series: daily/weekly phase executions and costs
- `GET /api/admin/analytics/engagements/[id]` — Per-engagement cost breakdown

### UI Pages
- `/admin/analytics` — Dashboard with:
  - Summary cards: Total Engagements, Phases Run, Tokens Used, Estimated Cost
  - User leaderboard table: User, Engagements, Phases, Tokens, Cost
  - Phase breakdown chart: Phase Number vs Avg Duration vs Avg Cost
  - Timeline chart: Daily phase executions (line chart)

### Acceptance Criteria
- [ ] Each API call's token usage is captured from Anthropic response
- [ ] PhaseExecution record created on every phase completion (success or failure)
- [ ] Admin analytics page shows per-user and per-phase cost breakdowns
- [ ] Cost estimates use model-specific pricing (Opus vs Sonnet)
- [ ] Duration tracked as wall-clock time from phase start to completion

---

## Module 4: Benchmark Management

### Schema Changes
- Create `BenchmarkRule` model:
  ```
  id, category (BACKEND/FRONTEND/FIXED_COST/INTEGRATION),
  taskPattern, lowHours, highHours,
  tier (T1/T2/T3, nullable for non-integrations),
  notes, techStack (nullable = applies to all),
  createdBy, updatedAt, isActive
  ```

### Data Migration
- Parse existing `benchmarks/*.md` files into `BenchmarkRule` records on first run
- Keep markdown files as read-only reference; DB is source of truth for runtime

### API Endpoints
- `GET /api/admin/benchmarks` — List all rules, filterable by category/techStack
- `POST /api/admin/benchmarks` — Create rule
- `PATCH /api/admin/benchmarks/[id]` — Update rule
- `DELETE /api/admin/benchmarks/[id]` — Soft delete (isActive = false)
- `GET /api/benchmarks` — Public endpoint for phase agents (returns active rules as formatted text for prompt injection)

### Integration with Phase Prompts
- `loadBenchmarks()` in `agent.ts` currently reads markdown files from disk
- Change to: query `BenchmarkRule` from DB, format as markdown table, inject into prompt
- Fallback: if DB empty, read from disk (migration not yet run)

### UI Pages
- `/admin/benchmarks` — Table: Category, Task Pattern, Low-High Hours, Tier, Tech Stack, Actions
- Inline edit for hours and notes
- Add new rule form
- Import from markdown (one-time migration button)

### Acceptance Criteria
- [ ] Admin can view all benchmark rules in a table
- [ ] Admin can add, edit, and deactivate benchmark rules
- [ ] Phase agents use DB benchmarks (with file fallback)
- [ ] Existing markdown benchmarks importable via admin UI

---

## Module 5: Prompt Management

### Schema Changes
- Create `PromptOverride` model:
  ```
  id, phaseNumber, promptType (SYSTEM/USER),
  content (text),
  version Int,
  isActive Boolean @default(true),
  createdBy, createdAt, updatedAt,
  notes (changelog entry)
  ```

### How It Works
- Code-defined prompts remain as defaults (in `phase-prompts.ts`)
- `PromptOverride` table stores admin edits per phase
- Phase config loading checks DB first; falls back to code if no active override
- Version history: each save creates a new version, only latest active one is used

### API Endpoints
- `GET /api/admin/prompts` — List all phases with current prompt (DB override or code default)
- `GET /api/admin/prompts/[phaseNumber]` — Get prompt detail with version history
- `PUT /api/admin/prompts/[phaseNumber]` — Save new version
- `POST /api/admin/prompts/[phaseNumber]/revert` — Revert to code default (deactivate all overrides)

### UI Pages
- `/admin/prompts` — Phase list showing: Phase Number, Label, Source (Code Default / Custom Override), Last Modified
- `/admin/prompts/[phaseNumber]` — Full-screen editor:
  - Two-column: left = editor (Monaco/textarea), right = preview (rendered markdown)
  - Variable reference panel: list of available template variables (techStack, engagementType, etc.)
  - Version history sidebar with diff viewer
  - "Revert to Default" button
  - "Save" creates new version

### Integration
- In `getPhaseConfig()` (`phases/index.ts`): before returning config, check `PromptOverride` for active override
- If found, replace `userPrompt` (and/or `systemPrompt`) with DB content
- Template variable interpolation: replace `{{techStack}}`, `{{engagementType}}` etc. at runtime

### Acceptance Criteria
- [ ] Admin can view current prompts for each phase
- [ ] Admin can edit and save prompt overrides (stored in DB with version history)
- [ ] Phase agents use DB prompts when available, code defaults otherwise
- [ ] Admin can revert to code defaults
- [ ] Version history shows diffs between versions

---

## Module 6: Admin Layout & Navigation

### Sidebar Changes (`Sidebar.tsx`)
- Add admin section (visible only when `session.user.role === "ADMIN"`):
  ```
  Admin
    Users
    Engagements
    Analytics
    Benchmarks
    Prompts
  ```

### Admin Layout
- `/admin/layout.tsx` — Shared layout with admin breadcrumb and role guard
- Reuses existing AppShell with admin-specific nav highlighting

### Acceptance Criteria
- [ ] Admin nav section visible only to ADMIN role users
- [ ] All admin pages share consistent layout
- [ ] Non-admin users redirected to dashboard if they navigate to /admin/*

---

## Implementation Order

| Phase | Modules | Dependencies |
|-------|---------|-------------|
| 1 | Module 6 (Layout) + Module 1 (Users) | None — unlocks admin section |
| 2 | Module 2 (All Engagements) | Module 6 |
| 3 | Module 3 (Analytics) — schema + data collection | Module 6. Requires agent.ts changes for token tracking |
| 4 | Module 3 (Analytics) — UI dashboard | Module 3 schema |
| 5 | Module 4 (Benchmarks) | Module 6 |
| 6 | Module 5 (Prompts) | Module 6 |

Phases 1-2 are foundational. Phase 3 requires the most code changes (agent.ts token tracking). Phases 5-6 are independent and can be done in any order.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token tracking adds latency to agentic loop | Accumulate in-memory, write once on completion |
| Prompt overrides break phase output format | Show warning if override removes CRITICAL heading markers |
| Benchmark DB migration loses data | Keep markdown files as read-only backup, import is additive |
| Admin blocks themselves | Prevent self-block in API; require another admin to block an admin |
| Large prompt edits in textarea | Use Monaco editor or CodeMirror for syntax highlighting |
