# Presales Estimation Tool — Internal Product Plan

> **Status**: Documented, ready for implementation
> **Branch**: `feat/presales-tool`
> **Created**: 2026-04-04
> **Last Updated**: 2026-04-04

---

## 1. Requirements Summary

| Attribute | Decision |
|-----------|----------|
| **Product** | Web-based internal tool for QED42's presales team to generate AI-powered effort estimates from TOR/RFP/SOW documents |
| **Users** | Non-technical presales managers and BDMs — guided UI, no CLI or AI complexity exposed |
| **UX Model** | Guided wizard with phase-gate checkpoints. User uploads TOR, AI runs phases autonomously, user reviews/approves at each gate |
| **AI Provider** | Claude only — Anthropic Claude Agent SDK (TypeScript) |
| **Infrastructure** | Docker Compose deployed via Coolify on AWS |
| **Scope** | Full product: engagement dashboard, multi-user auth, all 6 workflow phases, revision history, benchmark learning |
| **Timeline** | 8 weeks, 4 implementation phases |

---

## 2. Architecture Decision Record (ADR)

### ADR-001: Claude Agent SDK as AI Orchestration Layer

**Decision**: Use the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) as the primary AI orchestration layer.

**Drivers**:
1. The presales workflow requires document processing (Read/Glob/Grep), file generation (Write), web research (WebSearch/WebFetch), and multi-step agentic loops
2. Existing workflow is already built for Claude — CARL rules, CLAUDE.md prompts, templates, and benchmarks are all Claude-native
3. Team has chosen Claude-only; provider abstraction is unnecessary overhead

**Alternatives Considered**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Claude Agent SDK** | Built-in tools (Read/Write/Glob/Grep/WebSearch), autonomous agentic loop, session persistence, subagent support, hooks for progress streaming | Less granular cost control, locked to Anthropic, subprocess overhead (~200ms init) | **Chosen** |
| **Anthropic Client SDK (raw API)** | Maximum cost control (token counting, prompt caching, batch API), model selection per-turn | Must implement tool loop manually, must build all file I/O, no session persistence | Rejected — too much reimplementation of existing capabilities |
| **Anthropic Client SDK + LangGraph** | Best orchestration control, graph-based phase routing, state persistence | High complexity, LangGraph learning curve, still need custom tool implementations | Rejected — over-engineered for this use case; revisit if we hit Agent SDK limitations |
| **Vercel AI SDK** | Provider-agnostic, tight Next.js integration, `useChat` hooks | No built-in file I/O or system tools, Claude-only makes provider abstraction wasteful | Rejected — adds abstraction without benefit given Claude-only constraint |

**Consequences**:
- Each workflow phase maps 1:1 to an Agent SDK subagent with specific tools and system prompts
- CARL rules are embedded directly into system prompts (text injection, no CLI dependency)
- Session IDs enable phase resume across server restarts
- Hook callbacks stream progress events to frontend via SSE
- Cost monitoring requires external tracking (API usage dashboard) rather than per-turn budgets

**Follow-ups**:
- Monitor Anthropic's data retention policy for Agent SDK — sensitive TOR content flows through it
- If cost becomes an issue, consider migrating lightweight phases (formatting, proposal generation) to raw Client SDK with prompt caching
- Benchmark Agent SDK subprocess overhead under concurrent load; if >3s init time, consider pre-warmed worker pool

---

## 3. Tech Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Frontend** | Next.js (App Router) | 15.x | SSR, React Server Components, streaming UI. User's core stack. |
| **UI Components** | shadcn/ui + Tailwind CSS | Latest | Rapid, professional UI. Wizard/stepper/table patterns built-in. |
| **UI Quality** | impeccable.style | 1.6.0 | AI design skill — `/audit`, `/polish`, `/normalize` commands for consistent UI quality during development. Framework-agnostic, works with Tailwind. |
| **Backend API** | Next.js API Routes + Server Actions | — | Co-located with frontend, simplifies deployment to single container. |
| **AI Orchestration** | Claude Agent SDK (TypeScript) | Latest | Multi-phase agentic workflows with built-in tools (Read/Write/Glob/Grep/WebSearch/WebFetch). |
| **Database** | PostgreSQL | 16.x | Engagements, users, phase outputs, revision history, benchmarks. |
| **ORM** | Prisma | 6.x | Type-safe queries, migrations, schema management. |
| **Auth** | NextAuth.js | v5 | Google/Microsoft SSO for internal team. Domain-restricted. |
| **File Storage** | S3-compatible (MinIO dev / AWS S3 prod) | — | TOR uploads, generated artefacts, Excel files. |
| **Real-time** | Server-Sent Events (SSE) | — | Stream AI progress/status to frontend during phase execution. |
| **Queue** | BullMQ + Redis | — | Long-running AI phases as background jobs with progress tracking. |
| **Containerization** | Docker Compose | — | PostgreSQL, Redis, MinIO, Next.js app — single `docker compose up`. |

### impeccable.style Integration

impeccable.style is an AI design skill plugin (not a component library). It installs as Claude Code slash commands that enhance design judgment during development:

**Installation**: `npx skills add pbakaus/impeccable` in the project root.
**Setup**: Run `/teach-impeccable` once to generate `.impeccable.md` with project design context (Tailwind v4, shadcn/ui, Next.js 15 App Router).

**Commands used during development**:

| Command | When to Use |
|---------|-------------|
| `/audit` | After building each page — accessibility, performance, responsive design check (P0-P3 severity) |
| `/normalize` | After initial component creation — align with project design system |
| `/polish` | Before each implementation phase delivery — final refinement pass |
| `/typeset` | On text-heavy views (proposal viewer, artefact viewer) — fix typography hierarchy |
| `/arrange` | On dashboard and estimate table layouts — fix spacing rhythm |
| `/critique` | On key UX flows (wizard, phase gates) — Nielsen's heuristics review |
| `/harden` | On form components (create engagement, inline editors) — error handling, edge cases |
| `/onboard` | On dashboard empty state and create wizard — first-run experience for non-technical BDMs |
| `/clarify` | On estimate viewer (Conf, buffer formula, tier labels), phase gate actions, Q&A form instructions — translate domain jargon for non-technical users |
| `/adapt` | On estimate table (horizontal scroll on mobile) and phase gate split view (stacked on mobile) — proactive responsive design for hardest layouts |
| `/animate` | On PhaseTimeline status transitions, ProgressStream tool activity log, progress bar fills, phase gate unlock — transform waiting screens into engaging experiences |
| `/extract` | After Phase 2 completion — consolidate repeated patterns (status badges, color-coded indicators, card layouts) into design system |
| `/distill` | On information-dense views (phase gate + versioning, assumption tracking) — strip unnecessary complexity for non-technical users |
| `/optimize` | During final quality pass — catch rendering bottlenecks in estimate table (50-100 reactive rows), large markdown artefact viewer, SSE streams |

**Quality gate**: Run `/audit` on every page before marking an implementation phase complete. Fix all P0 (critical) and P1 (major) issues before proceeding.

---

## 4. Data Model

### Entity Relationship

```
User (1) ──── (N) Engagement
Engagement (1) ──── (N) Phase
Phase (1) ──── (N) PhaseArtefact
Engagement (1) ──── (N) Assumption
Engagement (1) ──── (N) RiskRegisterEntry
Benchmark ──── (0..1) Engagement (source)
```

### Schema

```prisma
model User {
  id          String       @id @default(cuid())
  email       String       @unique
  name        String
  role        UserRole     @default(MANAGER)
  avatarUrl   String?
  createdAt   DateTime     @default(now())
  lastLoginAt DateTime?
  engagements Engagement[]
}

enum UserRole {
  ADMIN
  MANAGER
  VIEWER
}

model Engagement {
  id             String            @id @default(cuid())
  clientName     String
  projectName    String?
  techStack      TechStack
  engagementType EngagementType    @default(NEW_BUILD)
  status         EngagementStatus  @default(DRAFT)
  createdBy      User              @relation(fields: [createdById], references: [id])
  createdById    String
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  phases         Phase[]
  assumptions    Assumption[]
  risks          RiskRegisterEntry[]
}

enum TechStack {
  DRUPAL
  DRUPAL_NEXTJS
  NEXTJS
  REACT
}

enum EngagementType {
  NEW_BUILD
  MIGRATION
  REDESIGN
  ENHANCEMENT
}

enum EngagementStatus {
  DRAFT
  IN_PROGRESS
  COMPLETED
  ARCHIVED
}

model Phase {
  id             String        @id @default(cuid())
  engagement     Engagement    @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  engagementId   String
  phaseNumber    String        // "0", "1", "1A", "2", "3", "4", "5"
  status         PhaseStatus   @default(PENDING)
  startedAt      DateTime?
  completedAt    DateTime?
  agentSessionId String?       // Claude Agent SDK session ID for resume
  artefacts      PhaseArtefact[]

  @@unique([engagementId, phaseNumber])
}

enum PhaseStatus {
  PENDING
  RUNNING
  REVIEW       // Awaiting user approval
  APPROVED
  SKIPPED
  FAILED
}

model PhaseArtefact {
  id           String        @id @default(cuid())
  phase        Phase         @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  phaseId      String
  artefactType ArtefactType
  version      Int           @default(1)
  contentMd    String?       // Markdown content (for text artefacts)
  fileUrl      String?       // S3 path (for binary files like Excel)
  metadata     Json?         // Flexible metadata (stats, counts, etc.)
  createdAt    DateTime      @default(now())

  @@unique([phaseId, artefactType, version])
}

enum ArtefactType {
  TOR_ASSESSMENT
  QUESTIONS
  ESTIMATE
  PROPOSAL
  GAP_ANALYSIS
  RESEARCH
  REVIEW
  RESPONSE_ANALYSIS
  ESTIMATE_STATE
}

model Assumption {
  id             String           @id @default(cuid())
  engagement     Engagement       @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  engagementId   String
  sourcePhaseId  String
  text           String
  torReference   String?          // TOR section/clause reference
  impactIfWrong  String           // What changes if assumption doesn't hold
  status         AssumptionStatus @default(ACTIVE)
  confirmedById  String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
}

enum AssumptionStatus {
  ACTIVE
  SUPERSEDED
  CONFIRMED
  REJECTED
}

model RiskRegisterEntry {
  id                String     @id @default(cuid())
  engagement        Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)
  engagementId      String
  task              String
  tab               String     // Backend, Frontend, Fixed Cost, AI
  conf              Int        // 1-6
  risk              String
  openQuestion      String     // For PM/Client
  recommendedAction String
  hoursAtRisk       Float
  createdAt         DateTime   @default(now())
}

model Benchmark {
  id                   String      @id @default(cuid())
  techStack            TechStack
  category             String      // e.g., "content_architecture", "integrations"
  taskType             String      // e.g., "content_type_simple", "T2_integration"
  lowHours             Float
  highHours            Float
  notes                String?
  sourceEngagementId   String?     // null = template default
  createdAt            DateTime    @default(now())

  @@index([techStack, category])
}
```

---

## 5. Application Structure

```
tool/
├── docker-compose.yml              # PG, Redis, MinIO, app
├── docker-compose.prod.yml         # Production overrides (S3, managed PG)
├── Dockerfile                      # Multi-stage: deps → build → runtime
├── .env.example                    # All env vars documented
├── .impeccable.md                  # impeccable.style design context (generated via /teach-impeccable)
├── prisma/
│   ├── schema.prisma               # Full schema (Section 4 above)
│   └── seed.ts                     # Default benchmarks from _template/benchmarks/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout: auth provider, sidebar nav, toast provider
│   │   ├── page.tsx                # Dashboard — engagement grid/list with search + filters
│   │   ├── login/
│   │   │   └── page.tsx            # Auth page (Google/Microsoft SSO)
│   │   ├── engagements/
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # 3-step create wizard (details → upload → confirm)
│   │   │   └── [id]/
│   │   │       ├── layout.tsx      # Engagement layout: header + tab nav
│   │   │       ├── page.tsx        # Overview — phase timeline + summary stats
│   │   │       ├── phases/
│   │   │       │   └── [phase]/
│   │   │       │       └── page.tsx  # Phase detail: progress stream OR review gate
│   │   │       ├── estimate/
│   │   │       │   └── page.tsx    # Tabbed estimate viewer/editor
│   │   │       ├── proposal/
│   │   │       │   └── page.tsx    # Technical proposal viewer
│   │   │       ├── assumptions/
│   │   │       │   └── page.tsx    # Assumption register with status tracking
│   │   │       └── risks/
│   │   │           └── page.tsx    # Risk register with filters
│   │   ├── settings/
│   │   │   └── page.tsx            # User management (admin only), benchmarks
│   │   └── api/
│   │       ├── engagements/
│   │       │   ├── route.ts        # GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET, PATCH, DELETE
│   │       ├── phases/
│   │       │   └── [id]/
│   │       │       ├── run/
│   │       │       │   └── route.ts  # POST — enqueue phase execution job
│   │       │       ├── approve/
│   │       │       │   └── route.ts  # POST — approve phase gate
│   │       │       └── sse/
│   │       │           └── route.ts  # GET — SSE stream for phase progress
│   │       ├── artefacts/
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET (content), PATCH (inline edits)
│   │       ├── upload/
│   │       │   └── route.ts        # POST — TOR file upload to S3
│   │       ├── export/
│   │       │   └── excel/
│   │       │       └── route.ts    # POST — generate & download Excel
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts    # NextAuth.js handlers
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── agent.ts            # Claude Agent SDK wrapper — runPhase(), prepareWorkDir()
│   │   │   ├── phases/
│   │   │   │   ├── phase0-research.ts      # Config: tools, prompt, maxTurns for Phase 0
│   │   │   │   ├── phase1-analysis.ts      # Config for Phase 1
│   │   │   │   ├── phase1a-estimate.ts     # Config for Phase 1A (estimate)
│   │   │   │   ├── phase1a-proposal.ts     # Config for Phase 1A (proposal)
│   │   │   │   ├── phase2-responses.ts     # Config for Phase 2
│   │   │   │   ├── phase3-review.ts        # Config for Phase 3
│   │   │   │   ├── phase4-gaps.ts          # Config for Phase 4
│   │   │   │   └── phase5-capture.ts       # Config for Phase 5
│   │   │   ├── prompts/
│   │   │   │   ├── system-base.ts          # Base system prompt (from CLAUDE.md)
│   │   │   │   ├── carl-rules.ts           # CARL presales rules as text (from .carl/presales)
│   │   │   │   └── phase-prompts.ts        # Per-phase user prompts
│   │   │   └── hooks.ts                    # Agent SDK hooks: progress reporting, validation
│   │   ├── db.ts                   # Prisma client singleton
│   │   ├── storage.ts              # S3/MinIO client — upload, download, delete, presigned URLs
│   │   ├── queue.ts                # BullMQ queue + job type definitions
│   │   └── auth.ts                 # NextAuth config — providers, callbacks, session
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # App sidebar: nav links, user avatar, engagement shortcuts
│   │   │   ├── Header.tsx          # Page header with breadcrumbs
│   │   │   └── AppShell.tsx        # Sidebar + main content wrapper
│   │   ├── engagement/
│   │   │   ├── EngagementCard.tsx  # Card: client name, tech badge, status, phase progress bar
│   │   │   ├── CreateWizard.tsx    # 3-step form: details → upload → confirm
│   │   │   ├── EngagementGrid.tsx  # Responsive grid of EngagementCards
│   │   │   └── SearchFilter.tsx    # Search bar + status/tech/date filters
│   │   ├── phase/
│   │   │   ├── PhaseTimeline.tsx   # Vertical stepper: phase cards with status/duration/artefacts
│   │   │   ├── PhaseCard.tsx       # Individual phase: icon, name, status badge, actions
│   │   │   ├── PhaseGate.tsx       # Split view: artefact (left) + summary stats (right) + actions
│   │   │   ├── ProgressStream.tsx  # Real-time AI progress: tool activity log with SSE
│   │   │   └── RunPhaseButton.tsx  # Button with confirmation modal
│   │   ├── artefact/
│   │   │   ├── ArtefactViewer.tsx  # Rendered markdown with table support
│   │   │   ├── ArtefactDiff.tsx    # Side-by-side or unified diff between versions
│   │   │   └── VersionSelector.tsx # Dropdown to switch artefact versions
│   │   ├── estimate/
│   │   │   ├── TabbedEstimate.tsx  # Tab container: Backend | Frontend | Fixed Cost | AI
│   │   │   ├── EstimateTable.tsx   # Sortable, inline-editable table per tab
│   │   │   ├── LineItemRow.tsx     # Single row: task, desc, conf, hours, low/high, actions
│   │   │   ├── ConfBadge.tsx       # Color-coded confidence badge (green 5-6, yellow 4, red 1-3)
│   │   │   ├── HoursCell.tsx       # Editable hours cell with auto Low/High recalc
│   │   │   └── ExportButtons.tsx   # "Download Excel" + "Generate Proposal" actions
│   │   ├── risk/
│   │   │   ├── RiskRegister.tsx    # Filterable table: task, tab, conf, risk, action, hours
│   │   │   └── RiskBadge.tsx       # Severity indicator
│   │   ├── assumption/
│   │   │   ├── AssumptionList.tsx  # Grouped by phase, status badges, impact-if-wrong
│   │   │   └── AssumptionActions.tsx # Confirm/reject/supersede buttons
│   │   └── ui/                     # shadcn/ui components (Button, Card, Dialog, Table, etc.)
│   └── workers/
│       └── phase-runner.ts         # BullMQ worker process — imports Agent SDK, runs phases
├── public/
│   └── ...                         # Static assets
├── scripts/
│   └── populate-estimate-xlsx.py   # Copied from _template/scripts/ — runs server-side
└── template-data/
    ├── templates/                  # Copied from _template/templates/
    ├── benchmarks/                 # Copied from _template/benchmarks/
    ├── carl-rules/                 # Exported from _template/.carl/
    └── commands/                   # Exported from _template/.claude/commands/
```

---

## 6. UI Design Specifications

### 6.1 Design System Foundation

**Setup**: After project scaffolding, run:
1. `npx skills add pbakaus/impeccable` — install AI design skill
2. `/teach-impeccable` — generate `.impeccable.md` with: Tailwind v4, shadcn/ui, Next.js 15 App Router, internal business tool, clean professional aesthetic

**Color System** (shadcn/ui defaults, customized):
- **Primary**: Slate-based neutrals (tinted, never pure gray — impeccable rule)
- **Accent**: Blue-600 for interactive elements, CTAs
- **Confidence scale**: Green-500 (Conf 5-6), Amber-500 (Conf 4), Red-500 (Conf 1-3)
- **Phase status**: Gray (pending), Blue (running), Amber (review), Green (approved), Red (failed), Slate (skipped)
- **Dark mode**: Support from day 1 via Tailwind `dark:` classes and shadcn theme tokens

**Typography**:
- Font: Inter (body) + JetBrains Mono (code/numbers in estimate tables)
- Scale: Tailwind default modular scale
- Run `/typeset` after implementing text-heavy views (proposal, artefact viewer)

**Spacing**: 8px grid system. Run `/arrange` to validate.

### 6.2 Page Layouts

#### Dashboard (`/`)

```
┌─────────────────────────────────────────────────────┐
│ [Sidebar]  │  Dashboard                    [+ New]  │
│            │                                         │
│ Dashboard  │  [Search...] [Status ▾] [Tech ▾]       │
│ Settings   │                                         │
│            │  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│ Recent:    │  │ Acme Corp│ │ BigRetail│ │ MegaCo  │ │
│ · Acme     │  │ Drupal   │ │ Next.js  │ │ React   │ │
│ · BigRtl   │  │ ████░░   │ │ ██░░░░   │ │ Draft   │ │
│            │  │ Phase 1A │ │ Phase 1  │ │         │ │
│            │  └──────────┘ └──────────┘ └─────────┘ │
│            │                                         │
│            │  ┌──────────┐ ┌──────────┐              │
│            │  │ OldClient│ │ Archive  │              │
│            │  │ Completed│ │ Archived │              │
│            │  └──────────┘ └──────────┘              │
└─────────────────────────────────────────────────────┘
```

- Responsive grid: 3 columns desktop, 2 tablet, 1 mobile
- Each card: client name, tech stack badge, status, phase progress bar, last activity
- Sidebar: fixed on desktop, collapsible drawer on mobile
- Empty state: illustration + "Create your first engagement" CTA

#### Create Engagement Wizard (`/engagements/new`)

```
┌─────────────────────────────────────────────────────┐
│           Create New Engagement                      │
│                                                      │
│  Step 1 ──●── Step 2 ──○── Step 3                   │
│  Details       Upload       Confirm                  │
│                                                      │
│  ┌────────────────────────────────────────────┐      │
│  │ Client Name    [________________]          │      │
│  │ Project Name   [________________] (opt.)   │      │
│  │ Tech Stack     [Drupal 10/11    ▾]         │      │
│  │ Engagement     [New Build       ▾]         │      │
│  │                                            │      │
│  │                      [Cancel] [Next →]     │      │
│  └────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

- 3-step horizontal stepper (shadcn/ui)
- Step 2: Drag-and-drop file upload zone (PDF, DOCX, MD). Multiple files supported.
- Step 3: Review summary card + "Create & Start Analysis" button
- On create: redirects to engagement overview, Phase 0 auto-enqueues

#### Engagement Overview (`/engagements/[id]`)

```
┌─────────────────────────────────────────────────────┐
│ [Sidebar] │ Acme Corp — Drupal 10/11                │
│           │ [Overview] [Estimate] [Proposal]         │
│           │ [Assumptions] [Risks]                    │
│           │─────────────────────────────────────────│
│           │                                          │
│           │  Phase Timeline          Summary         │
│           │                                          │
│           │  ✅ Phase 0: Research    Requirements: 47│
│           │     └ 12 min · 3 files   Clear: 28      │
│           │                          Ambiguous: 12   │
│           │  ✅ Phase 1: Analysis    Missing: 7      │
│           │     └ 8 min · 2 files                    │
│           │                          Hours (est):    │
│           │  🔵 Phase 1A: Estimate   Backend: 420    │
│           │     └ Running... 67%     Frontend: 180   │
│           │     [━━━━━━━░░░]         Fixed: 80       │
│           │                          Total: 680      │
│           │  ○ Phase 2: Responses                    │
│           │  ○ Phase 3: Review                       │
│           │  ○ Phase 4: Gap Analysis                 │
│           │                                          │
└─────────────────────────────────────────────────────┘
```

- Left: vertical phase timeline (stepper). Each phase card shows status icon, name, duration, artefact count.
- Right: summary stats panel — auto-updates as phases complete
- Running phase: animated progress bar + live tool activity log (expandable)
- Tab navigation: Overview | Estimate | Proposal | Assumptions | Risks

#### Phase Review Gate (`/engagements/[id]/phases/[phase]`)

```
┌─────────────────────────────────────────────────────┐
│ Phase 1: TOR Analysis — Review Required              │
│─────────────────────────────────────────────────────│
│                                                      │
│  ┌─ Artefact ──────────────┐ ┌─ Summary ──────────┐ │
│  │                         │ │                     │ │
│  │ # TOR Assessment        │ │ Requirements: 47    │ │
│  │                         │ │ ┌─────────────────┐ │ │
│  │ ## Content Architecture │ │ │ Clear      28   │ │ │
│  │ | Req | Clarity | ...   │ │ │ Needs Clar 12   │ │ │
│  │ |-----|---------|---     │ │ │ Ambiguous   5   │ │ │
│  │ | R1  | Clear   | ...   │ │ │ Missing     2   │ │ │
│  │ | R2  | Ambig   | ...   │ │ └─────────────────┘ │ │
│  │                         │ │                     │ │
│  │ ## Integrations         │ │ Questions: 23       │ │
│  │ ...                     │ │ Gaps flagged: 4     │ │
│  │                         │ │ Assumptions: 15     │ │
│  │ [v1 ▾] [Full screen]   │ │                     │ │
│  └─────────────────────────┘ └─────────────────────┘ │
│                                                      │
│  [← Back]   [Request Revision]  [Approve & Continue] │
│                                                      │
└─────────────────────────────────────────────────────┘
```

- Split layout: rendered artefact (left, ~60%) + summary stats (right, ~40%)
- Artefact viewer: rendered markdown with syntax-highlighted tables
- Version selector dropdown if multiple versions exist
- "Full screen" button for artefact deep-read
- Actions: Approve (proceeds to next phase), Request Revision (re-runs with feedback), Edit Manually (opens editor)

#### Estimate Viewer/Editor (`/engagements/[id]/estimate`)

```
┌─────────────────────────────────────────────────────┐
│ Estimate — Acme Corp            [Download Excel ↓]  │
│                                                      │
│ [Backend] [Frontend] [Fixed Cost] [AI]               │
│─────────────────────────────────────────────────────│
│                                                      │
│ Task          │ Description  │Conf│ Hrs │Low │High  │
│───────────────│──────────────│────│─────│────│──────│
│ Content Types │ 5 types per  │ 🟢5│  40 │ 40│  50  │
│               │ TOR §3.2     │    │     │    │      │
│ Custom Module │ Event calen  │ 🟡4│  32 │ 32│  48  │
│               │ T2 integr.   │    │     │    │      │
│ Search Config │ Solr per     │ 🔴3│  24 │ 24│  36  │
│               │ TOR §4.1     │    │     │    │      │
│───────────────│──────────────│────│─────│────│──────│
│                              │    │  96 │ 96│ 134  │
│                                                      │
│ ┌─ Risk Register (3 items) ──────────────────────┐  │
│ │ Search Config │ Backend │ Conf 3 │ 24h at risk │  │
│ │ ...                                             │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

- Tabs match Excel template: Backend, Frontend, Fixed Cost Items, AI
- Inline editing: click any cell to edit. Hours changes auto-recalculate Low/High via Conf buffer formula.
- ConfBadge: color-coded circle (green/yellow/red) + number
- Sortable columns: click header to sort by Conf, Hours, etc.
- Sticky header row + sticky totals row
- Risk Register: collapsible panel below table, filterable by tab/conf
- Export: "Download Excel" runs `populate-estimate-xlsx.py` server-side

### 6.3 Component Specifications

| Component | Props | Behavior |
|-----------|-------|----------|
| `EngagementCard` | engagement, onClick | Shows client, tech badge, status, progress bar. Click navigates to detail. |
| `PhaseTimeline` | phases[], currentPhase | Vertical stepper. Completed=checkmark, running=spinner+progress, pending=circle. |
| `PhaseGate` | phase, artefact, stats, onApprove, onRevise | Split view. Renders markdown artefact. Shows summary stats. Action buttons. |
| `ProgressStream` | phaseId | SSE connection. Shows live tool activity (tool name, status). Auto-scrolls. |
| `TabbedEstimate` | estimateData, onEdit | Tab container. Renders EstimateTable per tab. |
| `EstimateTable` | rows[], columns, onCellEdit | Sortable, inline-editable data table. Auto-recalculates derived fields. |
| `ConfBadge` | value (1-6) | Circle badge. 5-6=green, 4=yellow, 1-3=red. Tooltip shows buffer %. |
| `ArtefactViewer` | contentMd, version | Renders markdown via react-markdown + rehype plugins. Table support. |
| `CreateWizard` | onComplete | 3-step stepper form. Validates each step. File upload on step 2. |
| `RiskRegister` | risks[], filterTab? | Sortable table with severity indicators. Expandable rows for details. |

### 6.4 Responsive Breakpoints

| Breakpoint | Layout Changes |
|------------|---------------|
| `>= 1280px` (xl) | Sidebar visible, 3-column engagement grid, split phase gate |
| `>= 768px` (md) | Sidebar collapsible, 2-column grid, stacked phase gate |
| `< 768px` (sm) | Sidebar as drawer, 1-column grid, single-panel views, estimate table horizontal scroll |

### 6.5 UI Quality Gates (via impeccable.style)

After each implementation phase:
1. `/audit` all new pages — fix P0/P1 issues
2. `/normalize` all new components — align with design system
3. `/clarify` all user-facing labels and actions — ensure non-technical BDMs understand domain terminology
4. `/adapt` responsive-critical views (estimate tables, split layouts) — proactive mobile/tablet testing
5. `/polish` the complete flow — final refinement
6. `/harden` form components — error states, empty states, loading states

At key milestones:
- **After Phase 1 build**: `/onboard` on empty states + first-run flows, `/animate` on interactive components
- **After Phase 2 build**: `/extract` to consolidate shared patterns into design system
- **After Phase 3 build**: `/distill` information-dense views before complexity accumulates
- **Before production (Phase 4)**: `/optimize` full application for rendering performance

---

## 7. AI Orchestration Design

### 7.1 Agent SDK Integration Pattern

Each phase is a **managed agent session** running as a BullMQ background job:

```typescript
// src/lib/ai/agent.ts
import { query } from "@anthropic-ai/claude-agent-sdk";

interface PhaseConfig {
  engagementId: string;
  phase: string;
  techStack: TechStack;
  tools: string[];
  maxTurns: number;
  systemPrompt: string;
  userPrompt: string;
}

interface ProgressEvent {
  type: "progress" | "complete" | "error";
  tool?: string;
  message?: string;
  content?: string;
}

export async function* runPhase(config: PhaseConfig): AsyncGenerator<ProgressEvent> {
  const workDir = await prepareWorkDir(config.engagementId);
  // Copies: TOR files, templates, benchmarks, CARL rules, scripts into workDir

  for await (const message of query({
    prompt: config.userPrompt,
    options: {
      workDir,
      allowedTools: config.tools,
      systemPrompt: config.systemPrompt,
      maxTurns: config.maxTurns,
    }
  })) {
    if (message.type === "tool_use") {
      yield { type: "progress", tool: message.name, message: summarizeTool(message) };
    }
    if (message.type === "result") {
      yield { type: "complete", content: message.result };
    }
  }

  // Collect generated files from workDir → save as PhaseArtefacts
  const artefacts = await collectArtefacts(workDir, config.phase);
  await saveArtefacts(config.engagementId, config.phase, artefacts);
}

async function prepareWorkDir(engagementId: string): Promise<string> {
  const dir = `/data/engagements/${engagementId}`;
  // Ensure template data is copied on first use:
  // - templates/ from template-data/templates/
  // - benchmarks/ from template-data/benchmarks/
  // - .carl/ rules from template-data/carl-rules/
  // - scripts/ from template-data/commands/
  return dir;
}
```

### 7.2 Phase-to-Agent Mapping

| Phase | System Prompt Source | Key Tools | Max Turns | Typical Duration |
|-------|---------------------|-----------|-----------|-----------------|
| 0 - Research | CLAUDE.md Phase 0 + CARL rules | WebSearch, WebFetch, Read, Write | 80 | 10-15 min |
| 1 - TOR Analysis | CLAUDE.md Phase 1 + CARL rules | Read, Glob, Grep, Write | 60 | 5-10 min |
| 1A - Estimate | optimistic-estimate.md command + CARL rules | Read, Write, Glob, Bash | 100 | 15-25 min |
| 1A - Proposal | tech-proposal.md command | Read, Write | 40 | 5-10 min |
| 2 - Responses | CLAUDE.md Phase 2 | Read, Write | 40 | 3-5 min |
| 3 - Review | CLAUDE.md Phase 3 + CARL rules | Read, Glob, Grep, Write | 60 | 5-10 min |
| 4 - Gap Analysis | CLAUDE.md Phase 4 + CARL rules | Read, Write | 50 | 5-8 min |
| 5 - Capture | CLAUDE.md Phase 5 | Read, Write | 30 | 2-3 min |

### 7.3 Working Directory Strategy

Each engagement gets an isolated filesystem directory:

```
/data/engagements/{engagement_id}/
├── tor/                    # Uploaded TOR files (copied from S3 on phase start)
├── templates/              # Copied from template-data/templates/
├── benchmarks/             # Copied from template-data/benchmarks/
├── .carl/                  # CARL rules for this tech stack
├── research/               # Phase 0 output
├── initial_questions/      # Phase 1 output
├── estimates/              # Phase 1A output
├── claude-artefacts/       # All analysis artefacts
├── responses_qna/          # Phase 2 input (copied from S3)
└── scripts/                # populate-estimate-xlsx.py
```

This mirrors the existing `_template/` structure exactly, so all CARL rules, templates, and the xlsx script work without modification.

### 7.4 SSE Progress Streaming

```typescript
// src/app/api/phases/[id]/sse/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to BullMQ job progress events for this phase
      const subscription = await subscribeToPhaseProgress(params.id);

      subscription.on("progress", (event: ProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      });

      subscription.on("complete", (event: ProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 7.5 BullMQ Worker

```typescript
// src/workers/phase-runner.ts
import { Worker } from "bullmq";
import { runPhase } from "@/lib/ai/agent";
import { getPhaseConfig } from "@/lib/ai/phases";
import { prisma } from "@/lib/db";

const worker = new Worker("phase-execution", async (job) => {
  const { phaseId, engagementId, phaseNumber, techStack } = job.data;

  // Update phase status
  await prisma.phase.update({
    where: { id: phaseId },
    data: { status: "RUNNING", startedAt: new Date() }
  });

  const config = getPhaseConfig(phaseNumber, techStack, engagementId);

  try {
    for await (const event of runPhase(config)) {
      // Report progress to BullMQ (consumed by SSE endpoint)
      await job.updateProgress(event);
    }

    await prisma.phase.update({
      where: { id: phaseId },
      data: { status: "REVIEW", completedAt: new Date() }
    });
  } catch (error) {
    await prisma.phase.update({
      where: { id: phaseId },
      data: { status: "FAILED" }
    });
    throw error;
  }
}, {
  connection: { host: process.env.REDIS_HOST, port: 6379 },
  concurrency: 3, // Max 3 concurrent phase executions
});
```

---

## 8. Docker Compose

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://presales:presales@postgres:5432/presales
      REDIS_HOST: redis
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET: presales
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: http://localhost:3000
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    volumes:
      - engagement-data:/data/engagements
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      minio:
        condition: service_started

  worker:
    build: .
    command: node dist/workers/phase-runner.js
    environment:
      DATABASE_URL: postgresql://presales:presales@postgres:5432/presales
      REDIS_HOST: redis
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
      S3_BUCKET: presales
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    volumes:
      - engagement-data:/data/engagements
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: presales
      POSTGRES_PASSWORD: presales
      POSTGRES_DB: presales
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U presales"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  redisdata:
  miniodata:
  engagement-data:
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Docker Compose running with auth, DB, file upload, and Phase 1 (TOR Analysis) working end-to-end.

| # | Task | Files | Details |
|---|------|-------|---------|
| 1.1 | Project scaffolding | `tool/` root | Next.js 15, Prisma, shadcn/ui, Tailwind, Docker Compose |
| 1.2 | impeccable.style setup | `.impeccable.md` | `npx skills add pbakaus/impeccable`, `/teach-impeccable` |
| 1.3 | Database schema + seed | `prisma/schema.prisma`, `prisma/seed.ts` | Full schema from Section 4. Seed default benchmarks. |
| 1.4 | Auth | `src/lib/auth.ts`, `src/app/api/auth/` | NextAuth v5 + Google OAuth. Domain restriction. |
| 1.5 | App shell + sidebar | `src/components/layout/` | Sidebar nav, header, responsive shell |
| 1.6 | Dashboard | `src/app/page.tsx`, `src/components/engagement/` | Engagement grid, search/filter, empty state |
| 1.7 | Create engagement wizard | `src/app/engagements/new/` | 3-step form. File upload to MinIO. |
| 1.8 | Agent SDK wrapper | `src/lib/ai/agent.ts` | `runPhase()`, `prepareWorkDir()`, hooks |
| 1.9 | BullMQ worker | `src/workers/phase-runner.ts` | Phase execution queue, concurrency=3 |
| 1.10 | Phase 1 config | `src/lib/ai/phases/phase1-analysis.ts` | System prompt, tools, maxTurns |
| 1.11 | Phase timeline + gates | `src/components/phase/` | PhaseTimeline, PhaseGate, ProgressStream |
| 1.12 | SSE endpoint | `src/app/api/phases/[id]/sse/` | Real-time progress streaming |
| 1.13 | Artefact viewer | `src/components/artefact/` | Markdown renderer with tables |
| 1.14 | First-run experience | `src/app/page.tsx`, `src/app/engagements/new/` | `/onboard` on dashboard empty state + create wizard first-step — design proper onboarding for non-technical BDMs |
| 1.15 | Progress animations | `src/components/phase/` | `/animate` on PhaseTimeline status transitions, ProgressStream tool activity log entries, progress bar fills, phase gate unlock |
| 1.16 | UI quality pass | — | `/audit`, `/normalize`, `/polish` on all pages |

**Acceptance Criteria**:
- [ ] `docker compose up` starts all services, app accessible at localhost:3000
- [ ] User can sign in via Google OAuth
- [ ] User can create engagement with client name, tech stack, TOR upload
- [ ] Phase 1 (TOR Analysis) runs via BullMQ worker
- [ ] Progress stream shows live tool activity in UI with smooth entry animations
- [ ] Generated artefacts (tor-assessment.md, questions.md) viewable in phase gate
- [ ] User can approve phase, which updates status to APPROVED
- [ ] Dashboard empty state provides clear first-run guidance for new users
- [ ] Phase timeline transitions are animated (pending → running → review)
- [ ] `/audit` returns no P0/P1 issues on dashboard, create wizard, phase gate pages

### Phase 2: Core Estimation (Week 3-4)

**Goal**: Phase 0 + 1A working. User can go from TOR upload to downloadable Excel estimate.

| # | Task | Files | Details |
|---|------|-------|---------|
| 2.1 | Phase 0 config | `src/lib/ai/phases/phase0-research.ts` | WebSearch/WebFetch tools enabled |
| 2.2 | Phase 1A estimate config | `src/lib/ai/phases/phase1a-estimate.ts` | Full CARL rules in system prompt |
| 2.3 | Phase 1A proposal config | `src/lib/ai/phases/phase1a-proposal.ts` | Tech proposal generation |
| 2.4 | Tabbed estimate viewer | `src/components/estimate/` | TabbedEstimate, EstimateTable, ConfBadge |
| 2.5 | Excel export API | `src/app/api/export/excel/` | Runs populate-estimate-xlsx.py, returns .xlsx |
| 2.6 | Proposal viewer | `src/app/engagements/[id]/proposal/` | Rendered technical proposal |
| 2.7 | Risk register view | `src/components/risk/` | Filterable risk table |
| 2.8 | Phase auto-chain | `src/lib/ai/agent.ts` | On Phase 0 approve → auto-suggest Phase 1 |
| 2.9 | Engagement overview stats | `src/app/engagements/[id]/page.tsx` | Summary panel with hours, requirements, confidence |
| 2.10 | Estimate UX copy | `src/components/estimate/` | `/clarify` on estimate labels, Conf tooltips ("Conf 4 = moderate clarity, +50% buffer"), tier descriptions, phase gate action consequences |
| 2.11 | Responsive estimate & phase gate | `src/components/estimate/`, `src/components/phase/` | `/adapt` on estimate table (horizontal scroll + sticky columns on mobile) and phase gate split view (stacked layout on mobile) |
| 2.12 | Component extraction | `src/components/` | `/extract` to consolidate repeated patterns — status badges (EngagementCard, PhaseCard, AssumptionList), color-coded indicators (ConfBadge, RiskBadge), card layouts |
| 2.13 | UI quality pass | — | `/audit`, `/arrange` (tables), `/typeset` (proposal) |

**Acceptance Criteria**:
- [ ] Phase 0 → 1 → 1A pipeline works end-to-end
- [ ] Estimate viewer shows all 4 tabs (Backend/Frontend/Fixed Cost/AI)
- [ ] ConfBadge displays correct colors for each confidence level with explanatory tooltips
- [ ] Risk register renders with correct columns, filterable by tab
- [ ] "Download Excel" produces correctly populated QED42 template
- [ ] Proposal viewer renders full technical proposal as formatted document
- [ ] Phase gates block downstream phases until approved
- [ ] Estimate table is usable on mobile (horizontal scroll with sticky first column)
- [ ] Phase gate actions have clear consequence descriptions (not just "Approve" / "Revise")
- [ ] Shared design system components extracted for badges, indicators, and card patterns

### Phase 3: Response Integration & Review (Week 5-6)

**Goal**: Phases 2-4 working. Complete estimation workflow with inline editing.

| # | Task | Files | Details |
|---|------|-------|---------|
| 3.1 | Phase 2 config | `src/lib/ai/phases/phase2-responses.ts` | Response analysis agent |
| 3.2 | Q&A upload + inline form | `src/app/engagements/[id]/phases/2/` | Upload doc OR inline per-question form |
| 3.3 | Phase 3 config | `src/lib/ai/phases/phase3-review.ts` | Validation with CARL rules |
| 3.4 | Phase 4 config | `src/lib/ai/phases/phase4-gaps.ts` | Gap analysis generation |
| 3.5 | Inline estimate editing | `src/components/estimate/HoursCell.tsx` | Click-to-edit, auto-recalc Low/High |
| 3.6 | Artefact versioning | `src/components/artefact/VersionSelector.tsx` | Version dropdown, diff view |
| 3.7 | Assumption tracking | `src/app/engagements/[id]/assumptions/` | List, status badges, confirm/reject |
| 3.8 | Re-run with edits | Phase gate "Request Revision" | Revision feedback sent as prompt context |
| 3.9 | Simplify dense views | `src/components/phase/`, `src/components/assumption/` | `/distill` on phase gate (artefact + versioning + stats + actions) and assumption tracking — reduce cognitive load for non-technical users |
| 3.10 | Q&A form copy | `src/app/engagements/[id]/phases/2/` | `/clarify` on Q&A upload instructions, per-question inline form labels, revision feedback prompts |
| 3.11 | UI quality pass | — | `/audit`, `/harden` (forms), `/critique` (UX flows) |

**Acceptance Criteria**:
- [ ] User can upload Q&A responses or enter them inline per question
- [ ] Phase 2 maps responses to original questions and requirements
- [ ] Phase 3 produces coverage matrix, flags gaps and orphans
- [ ] Phase 4 generates gap analysis with revised estimates
- [ ] Inline estimate edits auto-recalculate Low/High hours using Conf buffer formula
- [ ] Artefact versions selectable, diff view shows changes between versions
- [ ] Assumptions trackable across phases with confirm/reject/supersede actions
- [ ] Phase gate view remains scannable despite added versioning and diff controls
- [ ] Q&A form provides clear instructions on expected input format

### Phase 4: Polish & Multi-user (Week 7-8)

**Goal**: Production-ready with team features, deployment, and knowledge capture.

| # | Task | Files | Details |
|---|------|-------|---------|
| 4.1 | Phase 5 config | `src/lib/ai/phases/phase5-capture.ts` | Knowledge capture → Benchmark table |
| 4.2 | Benchmark management | `src/app/settings/` | View/edit benchmarks, see historical data |
| 4.3 | Benchmark in estimates | `src/components/estimate/` | Show historical range tooltip on hours cells |
| 4.4 | Multi-user roles | `src/lib/auth.ts`, middleware | RBAC: admin (manage users), manager (full), viewer (read-only) |
| 4.5 | Engagement sharing | `src/app/engagements/[id]/` | Share engagement with team members |
| 4.6 | Notifications | `src/lib/notifications.ts` | Email/Slack on phase complete or needs review |
| 4.7 | Search & filter | `src/components/engagement/SearchFilter.tsx` | By client, status, tech stack, date range |
| 4.8 | Coolify deployment | `docker-compose.prod.yml`, Coolify config | SSL, domain, environment variables |
| 4.9 | Error tracking | Sentry integration | Client + server error capture |
| 4.10 | Performance optimization | — | `/optimize` on estimate table (50-100 reactive rows with inline editing), artefact viewer (large markdown rendering), SSE streams |
| 4.11 | Final UI quality pass | — | `/audit` + `/polish` full application |

**Acceptance Criteria**:
- [ ] Phase 5 stores engagement benchmarks to DB
- [ ] Historical benchmark ranges visible as tooltips in estimate viewer
- [ ] Viewer role cannot trigger phases, edit estimates, or approve gates
- [ ] Manager role has full access; Admin can manage users
- [ ] Notifications fire on phase completion and review-needed events
- [ ] Application deployed on Coolify/AWS, accessible via internal domain with SSL
- [ ] Sentry captures and reports errors
- [ ] Estimate table with 100 rows renders and edits without jank (60fps)
- [ ] `/audit` returns no P0/P1 issues across entire application

---

## 10. Risks and Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Agent SDK subprocess overhead under concurrent users (>3 simultaneous) | Medium | Slow response, timeouts | BullMQ queue with concurrency=3. Dedicated worker container. Monitor queue depth; scale workers if needed. |
| R2 | TOR documents exceeding 1M token context window | Low | Phase fails mid-execution | Pre-check doc token count via Anthropic token counting API. For very large TORs (>500 pages), chunk by section. |
| R3 | CARL rules not enforced outside CLI context | Medium | Estimation quality drops | Embed CARL rules as text in system prompts. Implement post-processing validation that checks all 20 rules programmatically. |
| R4 | Agent SDK data collection by Anthropic (sensitive TOR content) | Medium | Compliance concern | Review Anthropic data retention policy before production. Document in privacy policy. Consider raw Client SDK for sensitive phases if needed. |
| R5 | AI output quality inconsistency between runs | Medium | Estimates vary, team loses trust | Prompt caching for consistent behavior. Post-processing validation rules. Human review gates catch issues. Track quality metrics over time. |
| R6 | Excel population script failure (Python dependency) | Low | Broken exports | Run script in isolated Python sidecar container. Validate output before serving. Fallback: serve markdown estimate as downloadable file. |
| R7 | BullMQ/Redis failure loses in-progress phase work | Low | Phase must restart from scratch | Agent SDK session persistence enables resume. Redis persistence (AOF) for queue durability. |
| R8 | MinIO/S3 storage unavailable | Low | Cannot upload TOR or download exports | Health checks in Docker Compose. S3 client retry logic. Clear error messages to user. |

---

## 11. Verification Plan

| # | Verification | Method | Pass Criteria |
|---|-------------|--------|---------------|
| V1 | End-to-end smoke test | Upload real TOR PDF → run all phases → download Excel | Output quality comparable to CLI-generated estimates |
| V2 | CARL rule coverage | Run programmatic check against generated estimates for all 20 rules | All 20 rules pass validation |
| V3 | Concurrent users | Simulate 5 concurrent phase runs via load test | Queue processes correctly, no working directory conflicts, all complete within 2x single-run time |
| V4 | Phase gate enforcement | Attempt to run Phase 1A without approving Phase 1 | API returns 403, UI shows gate as locked |
| V5 | Data integrity | Delete engagement via API | Cascade deletes all phases, artefacts, assumptions, risks. S3 files cleaned up. |
| V6 | Auth boundary | Sign in as viewer, attempt to trigger phase | API returns 403, UI hides action buttons |
| V7 | Estimate inline edit | Edit hours cell, change Conf value | Low/High hours auto-recalculate. Changes persist on page reload. |
| V8 | SSE reliability | Disconnect/reconnect during phase execution | Progress stream resumes, no missed events |
| V9 | Excel export accuracy | Compare Excel output columns/values to markdown estimate | All tabs populated, all columns match, QA/PM rows correct |
| V10 | UI accessibility | Run `/audit` on all pages | No P0 (critical) accessibility issues |

---

## 12. Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key
NEXTAUTH_SECRET=random-32-char        # NextAuth session encryption
NEXTAUTH_URL=http://localhost:3000    # App URL (override in prod)
GOOGLE_CLIENT_ID=...                  # Google OAuth
GOOGLE_CLIENT_SECRET=...              # Google OAuth
DATABASE_URL=postgresql://...         # PostgreSQL connection
REDIS_HOST=redis                      # Redis hostname
S3_ENDPOINT=http://minio:9000        # S3/MinIO endpoint
S3_ACCESS_KEY=minioadmin             # S3 access key
S3_SECRET_KEY=minioadmin             # S3 secret key
S3_BUCKET=presales                   # S3 bucket name

# Optional
SENTRY_DSN=...                       # Error tracking
SLACK_WEBHOOK_URL=...                # Notifications
SMTP_HOST=...                        # Email notifications
ALLOWED_EMAIL_DOMAIN=qed42.com       # Restrict auth to domain
```
