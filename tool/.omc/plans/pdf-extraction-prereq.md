# Plan: PDF Extraction as a Prerequisite Step

## Problem
AI agent cannot read TOR PDFs. Returns `[Binary file: tor/requirements.pdf, size: X bytes]`. Existing PDFs in MinIO have no extracted `.md` files. Docker containers run old code without pdf-parse.

## Solution
Three changes to guarantee PDF text is always available before any phase runs:

---

## Step 1: Migration Script for Existing PDFs
**New file**: `tool/src/scripts/extract-existing-pdfs.ts`

- Connect to MinIO, list all `engagements/*/tor/*.pdf` objects
- For each PDF: download buffer, extract text via pdf-parse, upload `.md` alongside
- Skip if `.md` already exists
- Log results: extracted count, skipped count, errors

**Acceptance Criteria:**
- Run `npx tsx src/scripts/extract-existing-pdfs.ts` and all existing TOR PDFs get `.md` companions
- Idempotent — running twice doesn't duplicate work

---

## Step 2: Add Extraction Status to Upload API Response
**Modify**: `tool/src/app/api/upload/route.ts`

- Already done in previous changes (returns `extractedMd` field)
- No additional work needed

---

## Step 3: Rebuild Docker + Run Migration
**Commands:**
```bash
cd tool
docker compose build
docker compose up -d
docker compose exec app npx tsx src/scripts/extract-existing-pdfs.ts
```

**Acceptance Criteria:**
- `docker compose ps` shows all services healthy
- Existing UNDP Catalyst Hub PDF has a `.md` companion in MinIO
- Phase 0 can be re-run and the agent reads the TOR text successfully

---

## Files Changed Summary

| File | Action |
|------|--------|
| `src/scripts/extract-existing-pdfs.ts` | **new** — one-time migration |

## Risks
- Large PDFs (>30MB) will be skipped with a warning — unlikely for TOR docs
- Scanned/image PDFs will extract empty or garbled text — pdf-parse only handles text-layer PDFs
