# Plan: Admin UI for Prompt & Benchmark Management

## Requirements Summary

Enable admin users to manage prompts, CARL rules, benchmarks, and output templates via the Settings UI without code deployments. Currently all prompts are hardcoded in TypeScript files, benchmarks are filesystem-based `.md` files with a non-functional mock Settings page, and there's no version history or audit trail.

---

## Current Architecture

| Component | Source | Editable? |
|---|---|---|
| Base system prompt | `system-base.ts:1-29` | Hardcoded |
| CARL rules (19 rules) | `carl-rules.ts` | Hardcoded |
| Phase prompts (7 functions) | `phase-prompts.ts` | Hardcoded |
| Benchmarks (3 .md files) | `benchmarks/*.md` | Filesystem only |
| Output templates (5 .md files) | `templates/*.md` | Filesystem only |
| Model selection per phase | `agent.ts:38-43` | Env var + hardcoded |
| Phase tool selection | `phase*.ts` configs | Hardcoded |

**Prompt assembly flow** (`agent.ts:342-346`):
```
systemPrompt = getBaseSystemPrompt(techStack)
             + getCarlRules()
             + loadBenchmarks()
             + loadTemplate(phaseNumber)

userPrompt = getPhasePrompt(phaseNumber)
           + collectPriorContext(engagementId, phaseNumber)
```

---

## Acceptance Criteria

- [ ] AC1: Admin users can view and edit the base system prompt via Settings > Prompts tab
- [ ] AC2: Admin users can view, add, edit, and delete individual CARL rules via Settings > Rules tab
- [ ] AC3: Admin users can view and edit phase-specific prompts (one per phase) via Settings > Prompts tab
- [ ] AC4: Admin users can view, edit, and upload benchmark .md files via Settings > Benchmarks tab (replacing the current mock)
- [ ] AC5: Admin users can view and edit output template .md files via Settings > Templates tab
- [ ] AC6: All edits are persisted to database and take effect on the next phase run (no restart needed)
- [ ] AC7: Each edit creates a version record with timestamp, author, and previous content (audit trail)
- [ ] AC8: Non-admin users see read-only views of all configuration
- [ ] AC9: A "Reset to Default" action restores the original hardcoded value for any prompt/rule/benchmark
- [ ] AC10: The agent runtime (`agent.ts`) loads prompts/benchmarks from DB first, falling back to filesystem/code defaults

---

## Data Model

### New Prisma Models

```prisma
model PromptConfig {
  id          String   @id @default(cuid())
  key         String   @unique  // e.g., "system-base", "phase-0", "phase-1", "phase-1a-estimate", "carl-rules"
  label       String             // Human-readable name
  category    PromptCategory
  content     String             // The prompt text (markdown)
  isDefault   Boolean  @default(true)  // true if unchanged from code default
  updatedBy   String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
  versions    PromptVersion[]
}

enum PromptCategory {
  SYSTEM_BASE
  PHASE_PROMPT
  CARL_RULES
  BENCHMARK
  TEMPLATE
}

model PromptVersion {
  id            String       @id @default(cuid())
  promptConfig  PromptConfig @relation(fields: [promptConfigId], references: [id], onDelete: Cascade)
  promptConfigId String
  content       String       // Snapshot of content at this version
  changedBy     String       // User ID
  changeNote    String?      // Optional description of change
  createdAt     DateTime     @default(now())
}
```

**Key design**: A single `PromptConfig` table handles all configurable text (prompts, rules, benchmarks, templates). The `key` field identifies what it is, `category` enables filtering in the UI.

### Seed Data (Initial Keys)

| key | category | label |
|---|---|---|
| `system-base` | SYSTEM_BASE | Base System Prompt |
| `carl-rules` | CARL_RULES | CARL Estimation Rules |
| `phase-0` | PHASE_PROMPT | Phase 0: Research |
| `phase-1` | PHASE_PROMPT | Phase 1: TOR Assessment |
| `phase-1a-estimate` | PHASE_PROMPT | Phase 1A: Optimistic Estimate |
| `phase-1a-proposal` | PHASE_PROMPT | Phase 1A: Proposal |
| `phase-2` | PHASE_PROMPT | Phase 2: Response Integration |
| `phase-3` | PHASE_PROMPT | Phase 3: Estimate Review |
| `phase-4` | PHASE_PROMPT | Phase 4: Gap Analysis |
| `phase-5` | PHASE_PROMPT | Phase 5: Technical Proposal |
| `benchmark-drupal` | BENCHMARK | Drupal Effort Ranges |
| `benchmark-frontend` | BENCHMARK | Frontend Effort Ranges |
| `benchmark-general` | BENCHMARK | General Effort Ranges |
| `template-research` | TEMPLATE | Customer Research Template |
| `template-assessment` | TEMPLATE | TOR Assessment Template |
| `template-estimate` | TEMPLATE | Optimistic Estimate Template |
| `template-review` | TEMPLATE | Estimate Review Template |
| `template-gaps` | TEMPLATE | Gap Analysis Template |

---

## Implementation Steps

### Step 1: Prisma Schema + Migration
**File**: `prisma/schema.prisma`

Add `PromptConfig` and `PromptVersion` models. Run `prisma db push`.

### Step 2: Seed Script
**File**: New `prisma/seed-prompts.ts`

Reads current hardcoded values from `system-base.ts`, `carl-rules.ts`, `phase-prompts.ts`, benchmark `.md` files, and template `.md` files. Inserts them as `PromptConfig` records with `isDefault: true`. Idempotent (skips existing keys).

### Step 3: Runtime Loader
**File**: `src/lib/ai/prompt-loader.ts` (new)

```typescript
// Loads prompt/benchmark/template from DB, falls back to code default
export async function loadPromptConfig(key: string): Promise<string>
export async function loadAllBenchmarks(): Promise<string>
export async function loadPhaseTemplate(phaseNumber: string): Promise<string>
```

Uses a simple in-memory cache with 60s TTL to avoid DB queries on every phase run. Cache invalidated on admin edit.

### Step 4: Wire into Agent Runtime
**File**: `src/lib/ai/agent.ts`

Replace:
- `getBaseSystemPrompt(techStack)` -> `await loadPromptConfig("system-base")` (with techStack interpolation)
- `getCarlRules()` -> `await loadPromptConfig("carl-rules")`
- `loadBenchmarks()` -> `await loadAllBenchmarks()`
- `loadTemplate(phaseNumber)` -> `await loadPhaseTemplate(phaseNumber)`
- Phase prompts: each `getPhaseXPrompt()` call -> `await loadPromptConfig("phase-X")`

**Key constraint**: The `getBaseSystemPrompt` function accepts `techStack` as a parameter and interpolates it into the prompt text. The DB-stored version should use `{{techStack}}` as a placeholder that gets replaced at runtime.

### Step 5: Admin API Routes
**Files**: New routes under `src/app/api/admin/`

```
GET    /api/admin/prompts                  - List all prompt configs (filtered by category)
GET    /api/admin/prompts/[key]            - Get single prompt config with versions
PUT    /api/admin/prompts/[key]            - Update prompt content (creates version)
POST   /api/admin/prompts/[key]/reset      - Reset to default (restores hardcoded value)
GET    /api/admin/prompts/[key]/versions   - List version history
GET    /api/admin/prompts/[key]/versions/[id] - Get specific version content
POST   /api/admin/prompts/[key]/versions/[id]/restore - Restore a specific version
```

All routes gated with `requireRoles("ADMIN")` from `auth-guard.ts`.

### Step 6: Settings UI - Prompts Tab
**File**: `src/app/settings/page.tsx` (extend existing)

Replace the mock Benchmarks tab with a full configuration management UI:

**Tab structure**:
- **Prompts**: Base system prompt + phase prompts (sidebar list, editor on right)
- **Rules**: CARL rules (single markdown editor, or split into individual rules with add/delete)
- **Benchmarks**: Benchmark files (sidebar list per tech stack, markdown editor)
- **Templates**: Output templates (sidebar list, markdown editor)

**Editor component**: CodeMirror or a simple `<textarea>` with monospace font, line numbers, and markdown preview toggle. Start simple (textarea + preview), upgrade to CodeMirror later if needed.

**Each editor shows**:
- Current content (editable for admin, read-only for others)
- "Save" button (creates version, shows success toast)
- "Reset to Default" button (with confirmation dialog)
- "Version History" dropdown (shows past versions with timestamps and author)
- "Restore" action on each version
- Diff view between current and selected version (optional, nice-to-have)

### Step 7: Interpolation Support
**File**: `src/lib/ai/prompt-loader.ts`

Support template variables in stored prompts:
- `{{techStack}}` - replaced with engagement's tech stack
- `{{engagementType}}` - replaced with engagement type
- `{{clientName}}` - replaced with client name

This allows the base system prompt to reference dynamic values without requiring code changes.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Bad prompt edit breaks AI output quality | Version history enables instant rollback. "Reset to Default" restores known-good state. |
| Cache staleness after admin edit | Invalidate cache on PUT/POST to admin API. 60s TTL limits staleness window. |
| Large prompt text in DB | Prompt text is typically <10KB. PostgreSQL `text` type handles this easily. |
| Multiple admins editing simultaneously | Last-write-wins is acceptable for this scale. Show "last edited by X at Y" in UI. |
| Seed script runs on every deploy | Idempotent - only inserts if key doesn't exist. Never overwrites existing edits. |

---

## Verification Steps

1. Seed script populates all prompt configs from hardcoded defaults
2. Phase run uses DB-stored prompts (verify by editing a prompt and confirming AI output changes)
3. Admin can edit base system prompt via Settings > Prompts, save, and see version created
4. Admin can reset a prompt to default and confirm original text restored
5. Non-admin user sees read-only view of all prompts and benchmarks
6. Version history shows all edits with author and timestamp
7. Editing a benchmark in Settings > Benchmarks is reflected in the next phase run's system prompt

---

## Implementation Order

1. Step 1 (Schema) - foundation
2. Step 2 (Seed) - populate defaults
3. Step 3 (Runtime loader) - bridge DB to agent
4. Step 4 (Wire into agent) - make it live
5. Step 5 (API routes) - admin CRUD
6. Step 6 (Settings UI) - admin interface
7. Step 7 (Interpolation) - dynamic variables

---

## Out of Scope (for now)

- Per-engagement prompt overrides (all engagements share the same prompts)
- A/B testing different prompts
- Prompt performance metrics (which prompt versions produce better estimates)
- Role-based prompt visibility (all prompts visible to all users, editable by admins only)
- Importing/exporting prompt configurations
