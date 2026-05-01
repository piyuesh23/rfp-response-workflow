# Phase tier2-react-query: React Query Adoption - Research

**Researched:** 2026-05-01
**Domain:** TanStack Query v5 / Next.js 16 App Router / React 19 client-side data fetching
**Confidence:** HIGH

---

## Summary

`@tanstack/react-query` is NOT currently installed in `tool/package.json`. The entire dependency must be added. The app uses React 19 and Next.js 16, both of which are fully supported by TanStack Query v5.

The codebase has a consistent and widespread manual `fetch + useState + useEffect` pattern across at least 10 `"use client"` pages and the shared engagement layout. The highest-value targets are: the dashboard (`page.tsx`), the engagement overview (`engagements/[id]/page.tsx`), the engagement layout (`engagements/[id]/layout.tsx`), and the estimate page (`engagements/[id]/estimate/page.tsx`). The SSE hook (`useEngagementEvents`) already drives refetch — it just calls a `fetchEngagement` callback, which becomes `queryClient.invalidateQueries(...)` post-migration.

The inline estimate edit lives in `HoursCell.tsx` (an `onSave` prop callback), with the mutation logic upstream in whatever page loads the line items. Optimistic updates in React Query fit cleanly: `useMutation` with `onMutate`/`onError`/`onSettled`.

**Primary recommendation:** Install `@tanstack/react-query@^5`, add a `QueryClientProvider` in a new `tool/src/app/providers.tsx`, wrap `layout.tsx` body with it, then migrate pages in priority order: dashboard → engagement layout → engagement overview → estimate page → admin/analytics pages.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.x | Server-state cache, loading/error states, optimistic updates | De-facto standard; v5 is stable, ships with React 19 support |
| @tanstack/react-query-devtools | ^5.x | Dev-only query inspector overlay | Zero-config, tree-shakes in prod |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none additional) | — | No extra adapter needed | Next.js App Router + React 19 work with plain QueryClientProvider |

**Installation:**
```bash
cd tool && npm install @tanstack/react-query @tanstack/react-query-devtools
```

---

## Architecture Patterns

### Recommended Project Structure
```
tool/src/
├── app/
│   ├── providers.tsx       # NEW: QueryClientProvider wrapper (client component)
│   └── layout.tsx          # MODIFIED: import Providers, wrap children
├── hooks/
│   ├── useEngagements.ts   # NEW: useQuery for /api/engagements
│   ├── useEngagement.ts    # NEW: useQuery for /api/engagements/:id
│   └── useEngagementEvents.ts  # UNCHANGED — stays as raw EventSource hook
└── lib/
    └── query-keys.ts       # NEW: centralized query key factory
```

### Pattern 1: QueryClient Provider
**What:** Singleton `QueryClient` created outside the component tree, wrapped in a `"use client"` `Providers` component.
**When to use:** Always — this is the required mounting pattern for Next.js App Router.
**Example:**
```typescript
// tool/src/app/providers.tsx
"use client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }))
  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```
Then in `layout.tsx`, replace the `<TooltipProvider>` wrapper group with `<Providers><TooltipProvider>...</TooltipProvider></Providers>`.

### Pattern 2: Query Key Factory
**What:** Centralized object that generates typed query keys.
**When to use:** Every `useQuery` / `invalidateQueries` call references these keys.
```typescript
// tool/src/lib/query-keys.ts
export const queryKeys = {
  engagements: () => ["engagements"] as const,
  engagement: (id: string) => ["engagement", id] as const,
  engagementStats: (id: string) => ["engagement", id, "stats"] as const,
  phases: (engagementId: string) => ["engagement", engagementId, "phases"] as const,
  lineItems: (engagementId: string) => ["engagement", engagementId, "line-items"] as const,
}
```

### Pattern 3: SSE → invalidateQueries
**What:** In `useEngagementEvents` callback, replace the manual `fetchEngagement()` + interval pattern with `queryClient.invalidateQueries`.
**When to use:** On `phase_status_changed` SSE event.
```typescript
// inside EngagementOverviewPage (or a thin wrapper hook)
const queryClient = useQueryClient()
useEngagementEvents(id, useCallback((event) => {
  if (event.type === "phase_status_changed") {
    queryClient.invalidateQueries({ queryKey: queryKeys.engagement(id) })
    queryClient.invalidateQueries({ queryKey: queryKeys.engagementStats(id) })
    // Replace the catch-up polling interval with refetchInterval on the query itself
  }
}, [id, queryClient]))
```
The existing 8-second fallback polling while `anyRunning` can become `refetchInterval: anyRunning ? 8000 : false` on the `useQuery` option.

### Pattern 4: Optimistic Update on HoursCell
**What:** When the user commits an hours edit in `HoursCell`, fire a `useMutation` that immediately updates the query cache, then syncs with the server.
**When to use:** Any inline cell edit that touches `/api/engagements/:id/line-items/:itemId`.
```typescript
const mutation = useMutation({
  mutationFn: ({ id, hours }: { id: string; hours: number }) =>
    fetch(`/api/engagements/${engagementId}/line-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours }),
    }).then(r => r.json()),
  onMutate: async ({ id, hours }) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.lineItems(engagementId) })
    const previous = queryClient.getQueryData(queryKeys.lineItems(engagementId))
    queryClient.setQueryData(queryKeys.lineItems(engagementId), (old: LineItem[]) =>
      old.map(item => item.id === id ? { ...item, hours } : item)
    )
    return { previous }
  },
  onError: (_err, _vars, ctx) => {
    queryClient.setQueryData(queryKeys.lineItems(engagementId), ctx?.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.lineItems(engagementId) })
  },
})
```

### Anti-Patterns to Avoid
- **Creating `QueryClient` inside a component body:** Causes new client on every render. Always use `useState(() => new QueryClient())`.
- **Mixing `useQuery` + manual `useState` for the same data:** Pick one. After migration, remove all `useState`/`useEffect` pairs that were doing the fetch.
- **Calling `fetch` directly in SSE callback:** Use `invalidateQueries` instead — React Query handles deduplication and stale checks.
- **Skipping `staleTime`:** Default is 0, meaning every mount re-fetches. Set `staleTime: 30_000` globally; override per-query for volatile data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deduplication of concurrent fetches | Custom ref/promise cache | `useQuery` | Built-in request deduplication |
| Loading/error state per fetch | `useState(true)` + `try/catch` | `{ isPending, isError, error }` from `useQuery` | Consistent, race-condition-free |
| Optimistic cache update + rollback | Snapshot + setState in mutation | `useMutation` `onMutate`/`onError`/`onSettled` | Handles edge cases (component unmount mid-mutation) |
| Polling while phase running | `setInterval` + `clearInterval` in `useEffect` | `refetchInterval` option on `useQuery` | Cleaned up automatically on unmount |
| Cross-component cache invalidation | Shared Zustand/context slice | `queryClient.invalidateQueries(key)` | No extra store layer needed |

---

## Common Pitfalls

### Pitfall 1: `QueryClient` Not Available in Server Components
**What goes wrong:** Importing `useQuery` or `useQueryClient` in a server component throws at runtime.
**Why it happens:** All React Query hooks are client-side only.
**How to avoid:** Keep all `useQuery` calls in `"use client"` files. The existing pages already have `"use client"` at the top — no change needed there.

### Pitfall 2: `layout.tsx` Is a Server Component
**What goes wrong:** Adding `QueryClientProvider` directly in `layout.tsx` causes a build error because it creates a client-side instance.
**Why it happens:** `layout.tsx` has no `"use client"` directive and must remain a server component.
**How to avoid:** Create a separate `providers.tsx` client component and import it into `layout.tsx`. This is the standard App Router pattern.

### Pitfall 3: Duplicate Fetch on Mount (staleTime = 0)
**What goes wrong:** Every navigation to an engagement page fires a fresh network request even when data is fresh.
**Why it happens:** Default `staleTime` is 0ms.
**How to avoid:** Set `staleTime: 30_000` in the global `QueryClient` defaultOptions. For frequently-changing data (phase status while running), override with `staleTime: 0` and use `refetchInterval`.

### Pitfall 4: `useEngagementEvents` Hook Signature Does Not Change
**What goes wrong:** Refactoring the SSE hook to return a query object breaks existing consumers.
**Why it happens:** Treating SSE as a data source rather than a cache invalidation trigger.
**How to avoid:** `useEngagementEvents` stays exactly as-is. The callback consumer just calls `invalidateQueries` instead of a local `fetchEngagement` function.

### Pitfall 5: Engagement Layout Double-Fetches
**What goes wrong:** Both `layout.tsx` and `page.tsx` fetch `/api/engagements/:id` independently, causing two network requests.
**Why it happens:** No shared cache before React Query.
**How to avoid:** After migration, both components call `useQuery({ queryKey: queryKeys.engagement(id) })`. React Query deduplicates — only one network request fires for both, using the same cached result.

---

## Scope Boundary — Migrate Now vs Defer

### Migrate in This Phase (HIGH value, bounded risk)
| File | Pattern | Migration |
|------|---------|-----------|
| `tool/src/app/page.tsx` | `useEffect` → `fetch(/api/engagements)` | `useQuery(queryKeys.engagements())` |
| `tool/src/app/engagements/[id]/layout.tsx` | `useEffect` → `fetch(/api/engagements/:id)` | `useQuery(queryKeys.engagement(id))` |
| `tool/src/app/engagements/[id]/page.tsx` | `fetchEngagement` callback + SSE + polling | `useQuery` + `refetchInterval` + `invalidateQueries` in SSE handler |
| `tool/src/app/engagements/[id]/estimate/page.tsx` | `useEffect` → `fetch(/api/engagements/:id)` + line-item mutations | `useQuery` + `useMutation` with optimistic update |

### Defer to Later Phase (lower priority, higher disruption)
| File | Reason to Defer |
|------|----------------|
| `tool/src/app/admin/**` (8 pages) | Admin-only, low traffic, no optimistic updates needed |
| `tool/src/app/analytics/page.tsx` | Read-only, no mutation pattern |
| `tool/src/app/engagements/[id]/risks/page.tsx` | Small, no SSE interaction |
| `tool/src/app/engagements/[id]/assumptions/page.tsx` | Same as risks |
| `tool/src/app/settings/**` | Auth-adjacent, defer until post-migration validation |

---

## Code Examples

### Basic useQuery for Engagements Dashboard
```typescript
// Source: TanStack Query v5 docs - https://tanstack.com/query/latest/docs/framework/react/guides/queries
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

function useDashboardEngagements() {
  return useQuery({
    queryKey: queryKeys.engagements(),
    queryFn: () => fetch("/api/engagements").then(r => r.ok ? r.json() : Promise.reject(r)),
    staleTime: 30_000,
  })
}
```

### refetchInterval Pattern for Running Phase
```typescript
const { data: engagement } = useQuery({
  queryKey: queryKeys.engagement(id),
  queryFn: () => fetch(`/api/engagements/${id}`).then(r => r.json()),
  // Poll every 8s only while a phase is running — matches existing behavior
  refetchInterval: (query) => {
    const phases = query.state.data?.phases ?? []
    return phases.some((p: { status: string }) => p.status === "RUNNING") ? 8_000 : false
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual `setInterval` for polling | `refetchInterval` on `useQuery` | Auto-cleanup on unmount, no memory leaks |
| `useState(true)` for loading | `isPending` from `useQuery` | Race-condition-free, no flickering |
| `fetch` + manual rollback on error | `useMutation` `onMutate`/`onError` | Guaranteed rollback even on unmount |
| Calling `fetchEngagement()` from SSE | `invalidateQueries` | Deduplication, background refetch, no double-state |

---

## Open Questions

1. **Line item PATCH API endpoint exists?**
   - What we know: `/api/engagements/:id/line-items` is fetched in `estimate/page.tsx` (GET). `HoursCell.onSave` is a prop callback.
   - What's unclear: Whether a `PATCH /api/engagements/:id/line-items/:itemId` endpoint exists or needs to be created as part of this phase.
   - Recommendation: Verify before planning the optimistic update task. If not present, add to Wave 0 as a prerequisite.

2. **React 19 + TanStack Query v5 compatibility**
   - What we know: React 19 is a peer dependency requirement for TanStack Query v5 (confirmed stable as of v5.28+).
   - What's unclear: Whether any `use()` / server action patterns in the app create conflicts.
   - Recommendation: Install and run `npm run test:unit` immediately after install to catch any compatibility issues.

---

## Sources

### Primary (HIGH confidence)
- TanStack Query v5 official docs: https://tanstack.com/query/latest/docs/framework/react/overview
- Next.js App Router + React Query guide: https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
- Direct code inspection of `tool/package.json`, `tool/src/app/layout.tsx`, `tool/src/app/page.tsx`, `tool/src/app/engagements/[id]/page.tsx`, `tool/src/app/engagements/[id]/layout.tsx`, `tool/src/hooks/useEngagementEvents.ts`, `tool/src/components/estimate/HoursCell.tsx`

### Secondary (MEDIUM confidence)
- Pattern: `useState(() => new QueryClient())` — standard App Router provider pattern, documented in TanStack docs and widely used in Next.js community

---

## Metadata

**Confidence breakdown:**
- Install status: HIGH — verified by reading `package.json` directly
- Manual fetch inventory: HIGH — verified by reading source files directly
- Query key conventions: HIGH — derived from API URL patterns in source
- Provider placement: HIGH — verified against App Router constraints
- Optimistic update strategy: HIGH — standard TanStack Query v5 pattern
- SSE wiring: HIGH — `useEngagementEvents` signature read directly
- Scope boundary: HIGH — all admin/secondary pages verified by file listing

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (TanStack Query v5 is stable; Next.js 16 API is stable)
