# Plan: Master Template Population & UI Improvements

## Requirements Summary

Two work streams:

**WS1 — Master Excel Template Population Pipeline**: Copy `Master_Estimate_Template_Blank.xlsx` per engagement, populate specific tabs at specific phase transitions, show download status on engagement overview.

**WS2 — UI/UX Minor Fixes**: Improve summaries (no word counts — focus on quality metrics), narrow sidebar, file browser active state + Summary item, replace emdash/emoji with monochrome icons in AI output.

---

## Acceptance Criteria

### WS1: Master Template Population
- [ ] AC1: On engagement creation (`POST /api/engagements`), the Master template is copied to S3 at `engagements/{id}/estimates/Master_Estimate_Template.xlsx`
- [ ] AC2: After Phase 1 (TOR Assessment) completes and is approved, the "Questions for RFP" tab is populated from `initial_questions/questions.md` with columns: Broad Area, Reference to TOR, Question (rephrased as open-text, no MCQ, no impact text)
- [ ] AC3: After Phase 1 approval, the "Sales Detail" tab is populated with client/project data extracted from TOR metadata
- [ ] AC4: After Phase 1A (Optimistic Estimate) or Phase 3 (Estimate) completes, Backend/Frontend/Fixed Cost Items/AI tabs are populated using the Python script's column mappings (ported to Node.js/ExcelJS)
- [ ] AC5: Engagement overview page shows a "Template Status" card listing which tabs have been written, with a download link
- [ ] AC6: Download link serves the populated Excel file from S3 via presigned URL

### WS2: UI/UX Fixes
- [ ] AC7: Phase card summaries show only quality metrics (integrations, requirements, clarity, hours) — no word/character counts (already the case — verify no regression)
- [ ] AC8: Sidebar width reduced from `md:w-64` (256px) to `md:w-52` (208px)
- [ ] AC9: PhaseGate file browser right panel reduced from `md:w-[40%]` to `md:w-[30%]` for more reading room
- [ ] AC10: File browser has active state styling (already present at `PhaseGate.tsx:379`) and includes a "Summary" item at the top that shows the main artefact content
- [ ] AC11: AI phase prompts replace emdash (—) with hyphen (-) or colon (:) as separators
- [ ] AC12: No emoji characters in any AI-generated output (already the case — enforce)

---

## Implementation Steps

### WS1: Master Template Population Pipeline

#### Step 1: Copy template on engagement creation
**Files:** `tool/src/app/api/engagements/route.ts`, `tool/src/lib/storage.ts`

1. In `POST /api/engagements` (route.ts:26-69), after creating the engagement record:
   - Read `Master_Estimate_Template_Blank.xlsx` from the filesystem (it lives at `/templates/Master_Estimate_Template_Blank.xlsx` relative to project root — mount or embed this)
   - Upload to S3 at key `engagements/{engagement.id}/estimates/Master_Estimate_Template.xlsx`
   - Store the S3 key on the engagement record (add a `templateFileUrl` field to Prisma schema or track via a convention)
2. **Docker consideration**: The template file needs to be accessible inside the container. Add a COPY directive in `tool/Dockerfile` to copy `../templates/Master_Estimate_Template_Blank.xlsx` to `/app/templates/` or mount it as a volume.

#### Step 2: Add template population utility (Node.js/ExcelJS)
**Files:** New file `tool/src/lib/template-populator.ts`

Port the Python script's logic to Node.js using ExcelJS (already a dependency at v4.4.0). Create functions:

```typescript
// Populates specific tabs of the Master template Excel
export async function populateQuestionsTab(workbook: ExcelJS.Workbook, questionsMarkdown: string): Promise<void>
export async function populateSalesDetailTab(workbook: ExcelJS.Workbook, torMetadata: Record<string, unknown>): Promise<void>
export async function populateEstimateTabs(workbook: ExcelJS.Workbook, estimateMarkdown: string): Promise<void>
```

**Questions for RFP tab population:**
- Parse `questions.md` markdown (grouped by `## Section` headers)
- For each question row, extract:
  - **Broad Area**: The `## Section` header it belongs to
  - **Reference to TOR**: The TOR section/clause referenced in the question
  - **Question**: Rephrased as open-text. Strip MCQ options (A/B/C), remove "Impact of choosing..." paragraphs. Convert "Which approach do you prefer: A) X, B) Y, C) Z?" into "What is your preferred approach for [topic]? Options include X, Y, and Z."
- Column mapping for "Questions for RFP" sheet: determine from template inspection (likely B=Broad Area, C=Reference, D=Question starting at row 7)

**Sales Detail tab population:**
- Extract from TOR metadata and engagement record:
  - Client Name, Project Name, Tech Stack, Engagement Type
  - Key dates, scope summary, team composition (if available in TOR)
- Write to known cells in the "Sales Detail" sheet

**Estimate tabs population:**
- Reuse column mappings from Python script (Backend, Frontend, Fixed Cost Items, AI)
- Same row-6-header, row-7-start convention
- Domain grouping rows
- Parse markdown tables with same regex patterns

#### Step 3: Wire template population into phase-runner
**Files:** `tool/src/workers/phase-runner.ts`

After phase completion and artefact persistence, add template population hooks:

```
Phase 1 (TOR Assessment) approved → populate "Questions for RFP" + "Sales Detail" tabs
Phase 1A / Phase 3 approved → populate Backend/Frontend/Fixed Cost/AI tabs
```

Implementation in phase-runner.ts after line 89 (artefact creation):

1. After Phase 1 completes:
   - Download the engagement's template from S3
   - Load with ExcelJS
   - Call `populateQuestionsTab()` with the questions markdown from the phase's generated `initial_questions/questions.md`
   - Call `populateSalesDetailTab()` with engagement metadata
   - Save and re-upload to S3
   - Record which tabs were written (store in a `templateStatus` JSON field on the engagement, or create a `TemplateTab` model)

2. After Phase 1A/3 completes (already has Excel generation at lines 92-124):
   - Download template from S3
   - Call `populateEstimateTabs()` with the estimate markdown
   - Save and re-upload
   - Update template status

**Alternative approach**: Instead of modifying phase-runner directly, hook into the phase approval flow. When a phase transitions from REVIEW → APPROVED (in the `/api/phases/[id]/approve` route), trigger template population. This is cleaner because:
- Questions tab should only be written after Phase 1 is *approved* (not just completed)
- Estimate tabs after Phase 1A/3 is *approved*
- Avoids populating on phases that get rejected and re-run

#### Step 4: Track template population status
**Files:** Prisma schema, engagement API

Option A (simpler): Add a `templateStatus` JSON field to the Engagement model:
```prisma
model Engagement {
  // existing fields...
  templateStatus Json? // { questionsRfp: true, salesDetail: true, backend: true, frontend: true, fixedCost: true, ai: true }
}
```

Option B: Convention-based — check S3 for the template file's last-modified timestamp per tab. Less reliable.

**Recommendation**: Option A — add `templateStatus` field via Prisma migration.

#### Step 5: Engagement overview — template download card
**Files:** `tool/src/app/engagements/[id]/page.tsx`

Add a "Master Template" card in the right column (below EngagementStats) showing:
- Which tabs have been populated (green check icon for each: Questions for RFP, Sales Detail, Backend, Frontend, Fixed Cost, AI)
- Which tabs are pending (muted circle icon)
- Download button that fetches a presigned S3 URL for the template file

API: Add `templateStatus` to the engagement GET response. Add a download endpoint or reuse the existing file download route at `/api/engagements/[id]/files/estimates/Master_Estimate_Template.xlsx`.

#### Step 6: Review and align with existing Python script
**Files:** `scripts/populate-estimate-xlsx.py`

The Python script (`scripts/populate-estimate-xlsx.py`) is functional but:
- Only handles Backend/Frontend/Fixed Cost Items/AI tabs (no Questions for RFP, no Sales Detail)
- Looks for template in `estimation_template/` directory, not the Master template
- Outputs a separate `-optimistic.xlsx` file rather than populating in-place

**Decision**: Port to Node.js (ExcelJS) for the tool's runtime, keeping the Python script as a standalone CLI fallback for manual use. The Node.js port covers all tabs and operates on the copied Master template in S3.

---

### WS2: UI/UX Minor Fixes

#### Step 7: Narrow the sidebar
**Files:** `tool/src/components/layout/AppShell.tsx`

- Change `md:w-64` → `md:w-52` (line 24)
- Change `md:pl-64` → `md:pl-52` (line 36)
- Total savings: 48px more content width

#### Step 8: Narrow the PhaseGate file panel
**Files:** `tool/src/components/phase/PhaseGate.tsx`

- Change right panel from `md:w-[40%]` → `md:w-[30%]` (line 350)
- Left panel stays at `flex-1` (auto-expands to fill ~70%)

#### Step 9: Add "Summary" item to file browser
**Files:** `tool/src/components/phase/PhaseGate.tsx`

Before the file directory listing (line 362), add a "Summary" button at the top of the file list:
- Icon: `FileText` (monochrome)
- Label: "Summary"
- Click action: calls `handleBackToArtefact()` to show the main artefact markdown
- Active state: highlighted when `!viewingFile` (i.e., when the main artefact is shown)
- This gives users a way to navigate back to the artefact content from the file sidebar

#### Step 10: Replace emdash in AI prompts
**Files:** `tool/src/lib/ai/prompts/phase-prompts.ts`

Replace all `—` (emdash) characters with ` - ` (spaced hyphen) or `:` where it serves as a label separator. Occurrences found at lines 14, 86-92, 117, 122, 127.

Examples:
- `"Executive Summary — project understanding"` → `"Executive Summary: project understanding"`
- `"Pass 1 — Coverage"` → `"Pass 1: Coverage"`
- `"skip site audit unless..."` context already uses ` — ` → replace with ` - `

#### Step 11: Summaries quality check
**Files:** `tool/src/app/engagements/[id]/page.tsx` (lines 44-87), `tool/src/lib/ai/metadata-extractor.ts`

Current summaries already show quality metrics (integrations, requirements, clarity, hours) — no word counts found in codebase. **No code change needed** — just verify current behavior is correct.

If the user is seeing word-count-like output in the *AI-generated markdown content* (not the summary cards), add a prompt instruction in phase-prompts.ts:
- Add to the base system prompt: "Do not report word counts, token counts, or output length metrics. Focus summaries on substantive findings: requirement counts, clarity ratings, integration counts, effort ranges, and risk items."

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Master template not accessible inside Docker container | Template copy fails on engagement creation | Add COPY in Dockerfile or volume mount; fail gracefully with warning |
| ExcelJS cannot preserve all template formatting when loading/saving | Formulas, conditional formatting, or styling lost | Test with actual template; ExcelJS preserves most formatting on load/save round-trip |
| Questions markdown format varies between engagements | Parser fails to extract structured data | Use flexible regex patterns; fall back to raw question text if structured extraction fails |
| Phase approval hook adds latency to approval flow | User perceives slow approval | Run template population async (fire-and-forget after approval response) |
| Template file grows large with all tabs populated | Slow download | Excel files are typically small (<1MB); not a real concern |

---

## Verification Steps

1. Create a new engagement → verify Master template copied to S3 under `engagements/{id}/estimates/`
2. Run Phase 0 + Phase 1 → approve Phase 1 → verify "Questions for RFP" and "Sales Detail" tabs populated in the template
3. Choose NO_RESPONSE path → run Phase 1A → approve → verify Backend/Frontend/Fixed Cost/AI tabs populated
4. Engagement overview shows template status card with correct tab checkmarks and working download link
5. Sidebar is visibly narrower; content area has more space
6. PhaseGate file panel is narrower; markdown preview has more reading room
7. File browser shows "Summary" item at top with active state when viewing the artefact
8. Re-run any phase → verify AI output contains no emdash characters, no emoji, no word count references

---

## Implementation Order

1. **Step 7-8** (sidebar + panel narrowing) — quick CSS changes, immediate visual win
2. **Step 9** (Summary item in file browser) — small UI addition
3. **Step 10-11** (emdash + summary quality) — prompt text changes
4. **Step 4** (Prisma migration for templateStatus) — schema change needed early
5. **Step 1** (template copy on creation) — foundation for WS1
6. **Step 2** (template-populator.ts) — core logic
7. **Step 3** (wire into phase approval) — integration
8. **Step 5** (template status card on overview page) — UI for WS1
9. **Step 6** (Python script alignment) — documentation/cleanup
