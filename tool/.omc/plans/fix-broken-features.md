# Plan: Fix Broken Features — Metadata, Estimates, Proposal, Excel Export

## Context

Comparing tool output with reference artefacts from `../undp_catalyst_hub/`, several features are broken or showing mock data. This plan fixes all 5 issues in priority order.

## Quality Benchmark (from undp_catalyst_hub reference)

- **Phase 0 Research**: 455 lines, 10 CSV exports, hidden scope items with evidence
- **Phase 1 TOR Assessment**: 103 requirements individually assessed, 25 prioritized questions with options + effort deltas
- **Phase 1A Estimates**: 104 line items with Conf scores, CR boundaries, platform-native module names, domain-grouped
- **Phase 3 Review**: Traceability matrix mapping all 103 TOR requirements to estimate line items, gaps quantified as 800-1200 hrs
- **Phase 4 Gap Analysis**: Original vs revised hours per deliverable, confidence scores on every delta

---

## Issue 1: Worker Metadata Not Saved (Blocks Summary Stats)

**Root Cause**: `phase-runner.ts:64-71` creates PhaseArtefact with only `contentMd` — no `metadata` JSON.

**Fix**:
- After `runPhase()` completes and yields the final content, parse the markdown to extract structured stats
- Create `src/lib/ai/metadata-extractor.ts` with functions to parse markdown tables:
  - `extractEstimateMetadata(contentMd)` → `{ totalHours, hoursByTab, confidenceDistribution }`
  - `extractAssessmentMetadata(contentMd)` → `{ requirementCount, clarityBreakdown }`
  - `extractResearchMetadata(contentMd)` → `{ integrationsFound, hiddenScopeItems, riskCount }`
- Map phase number to extractor function
- Pass extracted metadata to `prisma.phaseArtefact.create({ data: { ..., metadata } })`

**Files**: `src/lib/ai/metadata-extractor.ts` (new), `src/workers/phase-runner.ts` (modify)

**Acceptance Criteria**:
- After Phase 1 completes, stats API returns `requirementCount > 0` and `clarityBreakdown` with non-zero values
- After Phase 1A completes, stats API returns `totalHours.low > 0` and `hoursByTab` populated
- Summary section on overview page shows real numbers after phases complete

---

## Issue 2: Estimate Tab Shows Mock Data

**Root Cause**: `src/app/engagements/[id]/estimate/page.tsx` hardcodes `MOCK_DATA` (Acme Corporation), never fetches real artefacts.

**Fix**:
- Convert to client component that fetches engagement data
- Find latest ESTIMATE artefact from phases (Phase 1A or Phase 3)
- Parse the estimate markdown to extract tabbed line items OR use artefact metadata
- Create `src/lib/estimate-parser.ts` to parse estimate markdown tables into `EstimateData` shape:
  - Detect `### Backend Tab`, `### Frontend Tab`, etc. sections
  - Extract table rows: Task | Conf | Low Hrs | High Hrs | Description
  - Transform into `{ tabs: [{ name, rows: EstimateRow[] }] }`
- Pass parsed data to existing `TabbedEstimate` component
- Show empty state if no estimate artefact exists yet

**Files**: `src/app/engagements/[id]/estimate/page.tsx` (rewrite), `src/lib/estimate-parser.ts` (new)

**Acceptance Criteria**:
- Estimate tab shows real data from Phase 1A artefact (not Acme Corporation mock)
- Tab structure matches Backend/Frontend/Fixed Cost Items/AI
- Conf scores, Low/High hours visible per line item

---

## Issue 3: Proposal Tab Shows Mock Data

**Root Cause**: `src/app/engagements/[id]/proposal/page.tsx` hardcodes mock proposal content.

**Fix**:
- Convert to client component that fetches engagement data
- Find latest PROPOSAL artefact (from Phase 1A-proposal)
- Render real `contentMd` using ArtefactViewer
- Version selector if multiple versions exist
- "Download PDF" button: use `window.print()` with print-optimized CSS (simplest approach), or generate via server-side rendering

**Files**: `src/app/engagements/[id]/proposal/page.tsx` (rewrite)

**Acceptance Criteria**:
- Proposal tab shows real AI-generated proposal content
- Download PDF triggers print dialog with clean formatting
- Empty state shown if no proposal artefact exists

---

## Issue 4: Excel Download Not Wired

**Root Cause**: `ExportButtons` component has `onDownloadExcel` callback but estimate page passes no props.

**Fix**:
- In estimate page, expose parsed estimate data as state
- Add `onDownloadExcel` handler:
  1. Collect current estimate tabs data
  2. Transform to `EstimateTab[]` format expected by `/api/export/excel`
  3. POST to `/api/export/excel` with `{ tabs, clientName }`
  4. Receive Blob, trigger browser download
- Wire to `<ExportButtons onDownloadExcel={handleDownloadExcel} />`

**Files**: `src/app/engagements/[id]/estimate/page.tsx` (modify after Issue 2 fix)

**Acceptance Criteria**:
- Click "Download Excel" → downloads .xlsx file
- Excel has 4 tabs (Backend, Frontend, Fixed Cost Items, AI)
- Each tab has correct line items matching the estimate artefact
- PM/QA overhead auto-calculated in Backend/Frontend tabs

---

## Issue 5: Auto-Generate Excel After Estimation Phase

**Root Cause**: Python script `scripts/populate-estimate-xlsx.py` exists but is standalone, not called by web UI.

**Fix**:
- After Phase 1A (or Phase 3 on response path) worker saves artefact:
  1. Call the existing ExcelJS-based export (already in `/api/export/excel/route.ts`)
  2. Parse estimate markdown → EstimateTab[] (reuse estimate-parser.ts from Issue 2)
  3. Generate Excel buffer
  4. Upload to MinIO as `engagements/{id}/estimates/{client}-estimate.xlsx`
  5. Create a second PhaseArtefact with `artefactType: ESTIMATE_STATE` and `fileUrl` pointing to the Excel
- This makes the Excel available in the Files tab automatically

**Files**: `src/workers/phase-runner.ts` (modify), `src/lib/estimate-parser.ts` (reuse)

**Acceptance Criteria**:
- After Phase 1A completes, an Excel file appears in MinIO under estimates/
- Excel file visible in the Files tab
- Excel has proper tabs with line items from the estimate

---

## Implementation Order

```
Issue 1 (metadata) ──→ Summary stats work
       ↓
Issue 2 (estimate tab) ──→ Real estimate data shown
       ↓
Issue 4 (excel download) ──→ Export works from estimate tab
       ↓
Issue 3 (proposal tab) ──→ Real proposal shown
       ↓
Issue 5 (auto excel) ──→ Excel auto-generated after estimation
```

## Files Changed Summary

| File | Action | Issue |
|------|--------|-------|
| `src/lib/ai/metadata-extractor.ts` | **new** | #1 |
| `src/lib/estimate-parser.ts` | **new** | #2, #4, #5 |
| `src/workers/phase-runner.ts` | modify | #1, #5 |
| `src/app/engagements/[id]/estimate/page.tsx` | rewrite | #2, #4 |
| `src/app/engagements/[id]/proposal/page.tsx` | rewrite | #3 |
