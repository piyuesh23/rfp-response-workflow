---
phase: tier2-react-query
plan: 01
subsystem: ui
tags: [tanstack-query, react-query, react, nextjs, optimistic-updates, sse, cache-invalidation]

# Dependency graph
requires: []
provides:
  - QueryClientProvider mounted at root layout with 30s staleTime and retry:1
  - queryKeys factory for all engagement/phase/line-item cache keys
  - Dashboard page using useQuery (no useState+useEffect fetch pair)
  - Engagement layout using useQuery sharing cache with overview page
  - Engagement overview using useQuery with refetchInterval and SSE invalidation
  - Estimate page using useQuery with useMutation and optimistic hour edits
  - PATCH /api/engagements/:id/line-items endpoint with conf-buffer recalculation
affects: [tier2-react-query, estimate, engagement-overview, dashboard]

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-query v5"
    - "@tanstack/react-query-devtools"
  patterns:
    - "QueryClientProvider as client boundary in server-component root layout"
    - "queryKeys factory for typed centralized cache key management"
    - "useQuery replaces useState+useEffect+fetch patterns"
    - "invalidateQueries in SSE callback instead of manual refetch"
    - "useMutation with onMutate/onError/onSettled for optimistic updates with rollback"

key-files:
  created:
    - tool/src/components/providers.tsx
    - tool/src/lib/query-keys.ts
  modified:
    - tool/src/app/layout.tsx
    - tool/src/app/page.tsx
    - tool/src/app/engagements/[id]/layout.tsx
    - tool/src/app/engagements/[id]/page.tsx
    - tool/src/app/engagements/[id]/estimate/page.tsx
    - tool/src/app/api/engagements/[id]/line-items/route.ts
    - tool/src/components/estimate/TabbedEstimate.tsx

key-decisions:
  - "QueryClient created inside useState() to prevent new instance per render on client components"
  - "Providers.tsx as dedicated 'use client' boundary so root layout.tsx remains a server component"
  - "queryKeys.phases() used for engagement overview query (not queryKeys.engagement()) to allow separate refetchInterval without affecting layout cache"
  - "Added onHoursSave prop to TabbedEstimate rather than passing mutation through EstimateTable/LineItemRow prop chain"
  - "handleDownloadExcel uses cached lineItems query data instead of a separate fetch call"

patterns-established:
  - "Pattern: Client boundary — wrap server layout in <Providers> client component, not 'use client' on layout"
  - "Pattern: SSE invalidation — useEngagementEvents callback calls queryClient.invalidateQueries, not local state setter"
  - "Pattern: Optimistic mutation — cancelQueries -> getQueryData -> setQueryData -> return ctx; onError restores ctx.previous"

requirements-completed:
  - TIER2-RQ-01

# Metrics
duration: 20min
completed: 2026-05-01
---

# Phase tier2-react-query Plan 01: TanStack Query Adoption Summary

**TanStack Query v5 installed with QueryClientProvider in root layout, 4 pages migrated from useState/useEffect to useQuery, SSE invalidation wired, and optimistic hour edits via useMutation with rollback in the estimate page**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-01T16:05:00Z
- **Completed:** 2026-05-01T16:14:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Installed @tanstack/react-query + devtools; mounted QueryClientProvider as client boundary in root layout without adding "use client" to layout.tsx
- Migrated dashboard, engagement layout, engagement overview, and estimate pages from manual fetch+setState to useQuery — SSE phase_status_changed now calls invalidateQueries instead of a local fetch function
- Added PATCH /api/engagements/:id/line-items with conf-buffer recalculation; estimate page wires useMutation with optimistic cache update on onMutate and cache rollback on onError

## Task Commits

1. **Task 1: Install React Query and mount QueryClientProvider** - `84c183f` (feat)
2. **Task 2: Migrate 4 pages to useQuery and wire SSE invalidation** - `72e1b28` (feat)
3. **Task 3: Add PATCH endpoint and optimistic useMutation for line item hours edit** - `5640478` (feat)

## Files Created/Modified

- `tool/src/components/providers.tsx` - "use client" QueryClientProvider + ReactQueryDevtools wrapper
- `tool/src/lib/query-keys.ts` - Typed queryKeys factory (engagements, engagement, phases, lineItems)
- `tool/src/app/layout.tsx` - Wraps children in <Providers> as client boundary
- `tool/src/app/page.tsx` - Dashboard: useQuery replaces useState+useEffect+fetch
- `tool/src/app/engagements/[id]/layout.tsx` - Engagement layout: useQuery replaces manual fetch
- `tool/src/app/engagements/[id]/page.tsx` - Overview: useQuery with refetchInterval + invalidateQueries in SSE callback
- `tool/src/app/engagements/[id]/estimate/page.tsx` - Estimate: useQuery + useMutation with optimistic update
- `tool/src/app/api/engagements/[id]/line-items/route.ts` - Added PATCH handler with validation and conf-buffer recalculation
- `tool/src/components/estimate/TabbedEstimate.tsx` - Added onHoursSave prop wired from cell edit to mutation

## Decisions Made

- QueryClient created inside useState() in Providers component (not module scope) — prevents shared instance across requests in server-side rendering
- Providers is a separate "use client" file; layout.tsx has no "use client" directive and stays a server component
- For engagement overview, used queryKeys.phases(id) as the query key (not queryKeys.engagement(id)) to allow independent refetchInterval without affecting the layout's engagement query cache entry
- Added onHoursSave prop to TabbedEstimate rather than threading mutation through EstimateTable -> LineItemRow -> HoursCell prop chain — simpler and less invasive

## Deviations from Plan

None - plan executed exactly as written.

Minor note: The plan suggested queryKeys.phases(id) for the overview page's query but the query fetches the same /api/engagements/:id endpoint as the layout — the separate key is intentional to allow the refetchInterval to operate independently on the overview page without making the layout poll.

## Issues Encountered

Pre-existing TypeScript errors in src/app/engagements/[id]/page.tsx (19 errors in original, 10 in migrated version — improvement) and src/lib/ai/agent.ts (ThinkingConfigParam type mismatch), src/components/phase/ModelOverrideSelect.tsx (null vs string type), vitest.config.ts (singleFork unknown property). None of these were introduced by this plan.

## Self-Check

- `tool/src/components/providers.tsx` — EXISTS
- `tool/src/lib/query-keys.ts` — EXISTS
- `tool/src/app/api/engagements/[id]/line-items/route.ts` — PATCH handler added
- Commit 84c183f — providers.tsx + query-keys.ts + layout.tsx
- Commit 72e1b28 — 4 pages migrated
- Commit 5640478 — PATCH endpoint + useMutation
- Unit tests: 18 passed (4 test files)

## Self-Check: PASSED

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- React Query foundation is in place; all future pages/features can import useQuery/useMutation from @tanstack/react-query
- queryKeys factory at src/lib/query-keys.ts is the canonical place to add new cache keys
- The PATCH /api/engagements/:id/line-items endpoint is ready for use by any optimistic edit surface

---
*Phase: tier2-react-query*
*Completed: 2026-05-01*
