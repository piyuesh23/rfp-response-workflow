---
phase: tier2-react-query
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tool/src/components/providers.tsx
  - tool/src/lib/query-keys.ts
  - tool/src/app/layout.tsx
  - tool/src/app/page.tsx
  - tool/src/app/engagements/[id]/layout.tsx
  - tool/src/app/engagements/[id]/page.tsx
  - tool/src/app/engagements/[id]/estimate/page.tsx
  - tool/src/app/api/engagements/[id]/line-items/route.ts
autonomous: true
requirements:
  - TIER2-RQ-01

must_haves:
  truths:
    - "App loads without runtime errors after QueryClientProvider is mounted"
    - "Dashboard page fetches engagements via useQuery — no useState/useEffect fetch pair remains"
    - "Engagement layout and overview share the same cached engagement query (no duplicate network requests)"
    - "SSE phase_status_changed event triggers queryClient.invalidateQueries for the engagement key"
    - "Editing hours in HoursCell optimistically updates the UI before the server response returns"
    - "A failed PATCH rolls back the optimistic update to the previous cache state"
  artifacts:
    - path: "tool/src/components/providers.tsx"
      provides: "QueryClientProvider client component wrapping app children"
      exports: ["Providers"]
    - path: "tool/src/lib/query-keys.ts"
      provides: "Centralized typed query key factory"
      exports: ["queryKeys"]
    - path: "tool/src/app/layout.tsx"
      provides: "Root layout with Providers wrapping TooltipProvider"
      contains: "<Providers>"
    - path: "tool/src/app/api/engagements/[id]/line-items/route.ts"
      provides: "PATCH endpoint for single line item hours update"
      exports: ["GET", "PATCH"]
  key_links:
    - from: "tool/src/app/layout.tsx"
      to: "tool/src/components/providers.tsx"
      via: "import and JSX wrapping"
      pattern: "<Providers>"
    - from: "tool/src/app/engagements/[id]/page.tsx"
      to: "useEngagementEvents"
      via: "invalidateQueries in SSE callback"
      pattern: "invalidateQueries.*engagement"
    - from: "tool/src/app/engagements/[id]/estimate/page.tsx"
      to: "tool/src/app/api/engagements/[id]/line-items/route.ts"
      via: "useMutation PATCH call"
      pattern: "PATCH.*line-items"
---

<objective>
Adopt TanStack Query v5 in the presales tool frontend in a single sequential wave: install the library, mount the provider, migrate the 4 highest-value pages from manual fetch patterns, wire SSE invalidation, and add optimistic updates for inline estimate hour edits.

Purpose: Eliminate race-condition-prone useState/useEffect fetch pairs, reduce duplicate network requests across shared routes (layout + page), and give inline edits instant feedback with server-synchronized rollback.

Output: QueryClientProvider in root layout, query-keys factory, 4 migrated pages, PATCH /api/engagements/:id/line-items/:itemId endpoint, useMutation with optimistic update on estimate page.
</objective>

<execution_context>
@/Users/piyuesh23/.claude/get-shit-done/workflows/execute-plan.md
@/Users/piyuesh23/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/tier2-react-query/RESEARCH.md

<interfaces>
<!-- Extracted from tool/src/app/layout.tsx -->
Current layout wraps children in:
  <TooltipProvider><AppShell>{children}</AppShell></TooltipProvider>
No "use client" directive — must remain a server component.
Replace with: <Providers><TooltipProvider><AppShell>{children}</AppShell></TooltipProvider></Providers>

<!-- Extracted from tool/src/hooks/useEngagementEvents.ts -->
export function useEngagementEvents(
  engagementId: string | null | undefined,
  onEvent: (event: EngagementEvent) => void
): void
// EngagementEvent.type values: "progress" | "phase_status_changed" | "connected" | "timeout" | "error"
// Hook signature is UNCHANGED — only the callback body changes (invalidateQueries instead of setState)

<!-- Extracted from tool/src/app/engagements/[id]/estimate/page.tsx -->
// Current pattern: single useEffect fetching /api/engagements/:id, then parsing estimate markdown
// Line items fetched via handleDownloadExcel() with fetch(`/api/engagements/${id}/line-items`) — GET only
// TabbedEstimate receives: initialData={estimateData}
// HoursCell.onSave originates inside TabbedEstimate/LineItemRow — executor must trace and wire useMutation there

<!-- Extracted from tool/src/app/api/engagements/[id]/line-items/route.ts -->
export async function GET(...): Promise<Response>
// No PATCH method exists — must be added in Task 3 before optimistic update can work
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install React Query and mount QueryClientProvider</name>
  <files>
    tool/src/components/providers.tsx,
    tool/src/lib/query-keys.ts,
    tool/src/app/layout.tsx
  </files>
  <action>
    Step 1 — Install packages:
    `cd tool && npm install @tanstack/react-query @tanstack/react-query-devtools`

    Step 2 — Create `tool/src/components/providers.tsx` as a "use client" component:
    - Import QueryClient, QueryClientProvider from @tanstack/react-query
    - Import ReactQueryDevtools from @tanstack/react-query-devtools
    - Create client via useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
    - Export named `Providers` component wrapping children in QueryClientProvider + ReactQueryDevtools (initialIsOpen={false})
    - NEVER create QueryClient outside useState — causes new instance per render

    Step 3 — Create `tool/src/lib/query-keys.ts`:
    ```typescript
    export const queryKeys = {
      engagements: () => ["engagements"] as const,
      engagement: (id: string) => ["engagement", id] as const,
      phases: (engagementId: string) => ["engagement", engagementId, "phases"] as const,
      lineItems: (engagementId: string) => ["engagement", engagementId, "line-items"] as const,
    }
    ```

    Step 4 — Edit `tool/src/app/layout.tsx`:
    - Import Providers from "@/components/providers"
    - Wrap the existing `<TooltipProvider>` block with `<Providers>...</Providers>`
    - layout.tsx has NO "use client" directive and must stay as-is — Providers is the client boundary
    - Result: `<Providers><TooltipProvider><AppShell>{children}</AppShell></TooltipProvider></Providers>`
  </action>
  <verify>
    <automated>cd /Users/piyuesh23/Operational/presales/_template/tool && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>TypeScript build emits no errors. providers.tsx and query-keys.ts exist with correct exports. layout.tsx imports and mounts Providers.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Migrate 4 pages to useQuery and wire SSE invalidation</name>
  <files>
    tool/src/app/page.tsx,
    tool/src/app/engagements/[id]/layout.tsx,
    tool/src/app/engagements/[id]/page.tsx,
    tool/src/app/engagements/[id]/estimate/page.tsx
  </files>
  <action>
    For each page, the migration pattern is: remove useState+useEffect+fetch, add useQuery, keep existing loading/error JSX (just swap the variables).

    **tool/src/app/page.tsx (dashboard):**
    - Replace `useState(engagements) + useEffect(fetch /api/engagements)` with:
      `const { data: engagements, isPending, isError } = useQuery({ queryKey: queryKeys.engagements(), queryFn: () => fetch("/api/engagements").then(r => r.ok ? r.json() : Promise.reject(r)) })`
    - Preserve existing loading spinner and error message JSX — just replace the boolean flags

    **tool/src/app/engagements/[id]/layout.tsx:**
    - Replace manual fetch with `useQuery({ queryKey: queryKeys.engagement(id), queryFn: ... })`
    - This page must become or already be "use client" if it uses hooks — add directive if missing
    - If layout passes engagement data to children via context, keep that pattern; just source data from useQuery

    **tool/src/app/engagements/[id]/page.tsx (overview):**
    - Replace `fetchEngagement` callback + polling interval with:
      `useQuery({ queryKey: queryKeys.phases(id), queryFn: () => fetch(\`/api/engagements/${id}\`).then(r => r.json()), refetchInterval: (query) => { const phases = query.state.data?.phases ?? []; return phases.some(p => p.status === "RUNNING") ? 8_000 : false } })`
    - Replace the SSE callback body: instead of calling a local fetch function, call:
      `queryClient.invalidateQueries({ queryKey: queryKeys.engagement(id) })`
      `queryClient.invalidateQueries({ queryKey: queryKeys.phases(id) })`
    - Use `useQueryClient()` to get the queryClient reference
    - `useEngagementEvents` hook signature is UNCHANGED — only the callback content changes

    **tool/src/app/engagements/[id]/estimate/page.tsx:**
    - Replace the useEffect that fetches `/api/engagements/${id}` with:
      `const { data, isPending, isError } = useQuery({ queryKey: queryKeys.engagement(id), queryFn: () => fetch(\`/api/engagements/${id}\`).then(r => r.json()) })`
    - Derive clientName, techStack, engagementType, updatedAt, estimateData from `data` in render (no separate state for these)
    - Keep handleDownloadExcel as-is (it does an ad-hoc fetch for Excel — not a useQuery concern)
    - Note: the TabbedEstimate's onSave wiring and line-items useQuery happen in Task 3
  </action>
  <verify>
    <automated>cd /Users/piyuesh23/Operational/presales/_template/tool && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>TypeScript build passes. All 4 pages import from @tanstack/react-query and query-keys.ts. No useState+useEffect fetch pairs remain for engagement/phase/engagements list data in these files.</done>
</task>

<task type="auto">
  <name>Task 3: Add PATCH endpoint and optimistic useMutation for line item hours edit</name>
  <files>
    tool/src/app/api/engagements/[id]/line-items/route.ts,
    tool/src/app/engagements/[id]/estimate/page.tsx
  </files>
  <action>
    **Step 1 — Add PATCH to line-items route:**
    Read `tool/src/app/api/engagements/[id]/line-items/route.ts` first.
    Add an `export async function PATCH(request: Request, { params }: { params: { id: string } })` handler:
    - Parse body: `{ itemId: string, hours: number }`
    - Validate: itemId must be non-empty string, hours must be a positive number
    - Use prisma to update the LineItem where `id = itemId AND engagementId = params.id`
    - Recalculate lowHrs and highHrs using the same conf-buffer formula as the existing GET handler
    - Return 200 with the updated line item on success, 400 on validation failure, 404 if not found
    - Follow the same error-handling and response pattern as the existing GET handler

    **Step 2 — Add line items useQuery to estimate page:**
    In `tool/src/app/engagements/[id]/estimate/page.tsx`, add:
    `const { data: lineItems } = useQuery({ queryKey: queryKeys.lineItems(id), queryFn: () => fetch(\`/api/engagements/${id}/line-items\`).then(r => r.json()) })`

    **Step 3 — Add useMutation with optimistic update:**
    In the same estimate page, add a mutation for saving hours:
    ```typescript
    const queryClient = useQueryClient()
    const mutation = useMutation({
      mutationFn: ({ itemId, hours }: { itemId: string; hours: number }) =>
        fetch(`/api/engagements/${id}/line-items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, hours }),
        }).then(r => r.ok ? r.json() : Promise.reject(r)),
      onMutate: async ({ itemId, hours }) => {
        await queryClient.cancelQueries({ queryKey: queryKeys.lineItems(id) })
        const previous = queryClient.getQueryData(queryKeys.lineItems(id))
        queryClient.setQueryData(queryKeys.lineItems(id), (old: LineItem[] | undefined) =>
          old?.map(item => item.id === itemId ? { ...item, hours } : item) ?? old
        )
        return { previous }
      },
      onError: (_err, _vars, ctx) => {
        queryClient.setQueryData(queryKeys.lineItems(id), ctx?.previous)
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.lineItems(id) })
      },
    })
    ```
    Pass `onSave={(itemId, hours) => mutation.mutate({ itemId, hours })}` to TabbedEstimate (or wherever HoursCell.onSave originates). Trace the prop chain: EstimatePage -> TabbedEstimate -> LineItemRow -> HoursCell.onSave. If onSave is on TabbedEstimate, add that prop; if it is on a child, pass through accordingly.

    Note: If the pre-existing e2e ESM failure in global-setup.ts surfaces, document the error message verbatim in the SUMMARY but do not treat it as a blocker for this task.
  </action>
  <verify>
    <automated>cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:unit 2>&1 | tail -30</automated>
  </verify>
  <done>PATCH /api/engagements/:id/line-items returns 200 with updated item for valid payload. useMutation is wired in estimate page. onMutate applies optimistic cache update before fetch resolves. onError rolls back. Unit tests pass.</done>
</task>

</tasks>

<verification>
After all 3 tasks complete, verify end-to-end integrity:

1. TypeScript: `cd tool && npx tsc --noEmit` — zero errors
2. Unit tests: `cd tool && npm run test:unit` — all pass
3. Manual smoke check (if app is running):
   - Dashboard loads engagement list without visible flash/refetch on tab focus within 30s window
   - Navigate to an engagement — layout and overview share one network request to /api/engagements/:id (check Network tab: single request, not two)
   - Edit an hours value in the estimate tab — cell updates instantly before server responds
   - Reject the PATCH (kill network or modify to 500) — cell reverts to previous value

4. E2E caveat: If `npm run test:e2e` fails with ESM error in global-setup.ts, record the exact error in SUMMARY under "Known Pre-existing Failures" and proceed. This is a pre-existing issue unrelated to React Query adoption.
</verification>

<success_criteria>
- `@tanstack/react-query` and `@tanstack/react-query-devtools` present in tool/package.json
- `tool/src/components/providers.tsx` exists and exports `Providers`
- `tool/src/lib/query-keys.ts` exists and exports `queryKeys` with engagements, engagement, phases, lineItems keys
- `tool/src/app/layout.tsx` wraps children in `<Providers>`
- All 4 migrated pages use `useQuery` with keys from queryKeys factory — no useState+useEffect fetch pairs for engagement/phases/engagements data
- SSE `phase_status_changed` event calls `invalidateQueries` (not a local fetch function)
- `PATCH /api/engagements/:id/line-items` returns 200 with updated line item
- `useMutation` in estimate page applies optimistic update on `onMutate` and rolls back on `onError`
- TypeScript build passes with zero errors
- Unit tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/tier2-react-query/tier2-react-query-01-SUMMARY.md` following the summary template.
</output>
