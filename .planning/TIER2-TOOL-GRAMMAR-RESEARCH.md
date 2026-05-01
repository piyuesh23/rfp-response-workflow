# Tier 2 Tool Grammar Tightening — Research

**Date:** 2026-05-01
**Domain:** agent.ts tool dispatch, Anthropic prompt caching
**Confidence:** HIGH (all findings are from direct source-code inspection)

---

## 1. Tool Handler Gap: The Core Bug

### Finding: `getToolHandlers` returns ALL tools regardless of phase declaration

In `agent.ts` line 716:
```ts
const tools    = getToolDefinitions(config.tools);  // filtered — only declared tools sent to API
const handlers = getToolHandlers(config.engagementId, workDir); // UNFILTERED — always all 7 handlers
```

`getToolHandlers` (tools.ts line 184) returns a plain object with all 7 keys:
`read_file`, `write_file`, `list_files`, `search_content`, `web_fetch`, `web_search`, `run_command`

It takes no `toolNames` argument and does no filtering.

The dispatch in the agentic loop (agent.ts line 848):
```ts
const handler = handlers[block.name];
if (!handler) {
  result = `Tool '${block.name}' is not available in this phase.`;
}
```

This means: if a phase declares `tools: ["Read", "Glob"]`, the API only receives definitions for
`read_file` and `list_files` (so Claude cannot ask for others). However IF Claude somehow
invokes `write_file`, the handler **exists** and **will execute**. The API filter is the only
guard — there is no handler-side enforcement.

**Risk level:** Low-to-medium. The API tool definitions are the primary security boundary
(Claude can only call tools whose schemas are sent). But defense-in-depth is missing: a
misbehaving model, prompt injection in a TOR document, or future code that passes extra
tool names could bypass the intent.

**Fix complexity:** Small. Add a filter set at construction time and check it before dispatch.

---

## 2. Per-Phase Tool Audit

| Phase | File | Declared Tools | Purpose Fit | Issues |
|-------|------|---------------|-------------|--------|
| 0 — Research | phase0-research.ts | Read, Write, Glob, WebSearch, WebFetch | Correct — needs web access + writes research output | No Grep; probably fine (web-heavy phase) |
| 1 — TOR Analysis | phase1-analysis.ts | Read, Glob, Grep, Write | Correct | None |
| 1A — Estimation | phase1a-estimate.ts | Read, Write, Glob, Grep, **Bash** | Bash included — allows run_command (wc, sort, cat, ls, find, diff, etc.) | Bash is over-declared; estimation only reads TOR + writes estimate. No shell command needed. |
| 1A — Proposal | phase1a-proposal.ts | Read, Write | Correct — narrow | None |
| 1A — Legacy Checklist | phase1a-legacy-checklist.ts | Read, Write, Glob | Correct | None |
| 2 — Responses | phase2-responses.ts | Read, Write, Glob, Grep | Correct | None |
| 3 — Review | phase3-review.ts | Read, Glob, Grep, Write | Correct | None |
| 4 — Gaps | phase4-gaps.ts | Read, Write, Glob, Grep | Correct | None |
| 5 — Proposal | phase5-capture.ts (line 341) | Read, Write | Correct — narrow | None |

**Over-declared phases:**
- **Phase 1A (estimate):** `Bash` is declared but the phase only reads TOR files and writes
  estimates. `run_command` exposes `wc`, `sort`, `head`, `tail`, `cat`, `ls`, `find`, `diff`,
  `uniq`, `cut`, `tr`, `date`, `echo` to the model unnecessarily. Remove `Bash`.

**Under-declared (worth checking):**
- Phase 0 lacks `Grep` — probably intentional since web research dominates, but if the agent
  needs to search across downloaded files, it can only use `list_files`. Low priority.

---

## 3. Benchmark Caching: Current Behavior

### Architecture (agent.ts lines 652–756)

```
loadBenchmarks()  →  benchmarks string (loaded ONCE per runPhase() call)
enrichedSystemPrompt = baseSystemPrompt + benchmarks + template
```

Each turn of the agentic loop calls:
```ts
anthropic.messages.stream({
  system: [{ type: "text", text: enrichedSystemPrompt, cache_control: { type: "ephemeral" } }],
  ...
})
```

### Does the current caching work?

**Yes, with one caveat.**

Anthropic's prompt caching requires the `cache_control: { type: "ephemeral" }` block content
to be byte-for-byte identical across API calls within the same session (5-minute TTL for
ephemeral). Since `enrichedSystemPrompt` is assembled once before the loop and never mutated,
every turn sends the same string — the cache WILL hit on turns 2+.

The caveat: `loadBenchmarks()` has three code paths (PromptConfig DB → benchmark table DB →
disk files). If the DB has no records and disk files change between restarts, the benchmark
string changes and invalidates the cache on next cold start. This is expected and acceptable.

### Token size of benchmarks

Disk benchmark files total ~32 KB (30,000 chars). At ~4 chars/token this is roughly
**~8,000 tokens** injected into every phase that hits the disk fallback. The DB table path
formats as a compact markdown table — likely 2,000–5,000 tokens depending on row count.

### Single vs dual cache_control blocks

**Current:** One system block = `baseSystemPrompt + benchmarks + template`. Entire string
cached as one unit.

**Alternative: Two system blocks**

Anthropic supports multiple system content blocks. Each can have independent `cache_control`:

```ts
system: [
  { type: "text", text: baseSystemPrompt,         cache_control: { type: "ephemeral" } },
  { type: "text", text: benchmarks + template,    cache_control: { type: "ephemeral" } },
]
```

**Benefit of two blocks:** If `baseSystemPrompt` changes between engagements (different
`techStack` interpolation) but `benchmarks` is the same, the second block's cache can still
hit. In practice:

- `baseSystemPrompt` includes `techStack` interpolation → changes per engagement
- `benchmarks` is global (not per-engagement) → stable across engagements run on same server

With a single block, a different `techStack` causes a full cache miss — both base + benchmarks
re-tokenize. With two blocks, only the first block misses; benchmarks cache persists.

**Recommendation:** Split into two blocks. The change is small (3 lines in agent.ts) and
gives longer cache hits for the benchmark+template block across engagements with different
tech stacks.

**Important:** Anthropic requires `cache_control` to appear on the LAST block that should be
cached. So if using two blocks, put `cache_control` on the SECOND block (or both). The SDK
supports per-block `cache_control` as of the Messages API with the `cache-control` beta.

---

## 4. Security / Isolation Wins from Tighter Tool Restriction

| Issue | Current State | After Fix |
|-------|--------------|-----------|
| Handler-side bypass possible | Any tool handler executes if Claude names it correctly, even if not in definitions | Filter dropped at handler lookup; `write_file` handler call fails fast if `Write` not declared |
| Phase 1A can run shell commands | `Bash` declared → `run_command` handler available (cat, find, diff, etc.) | Remove `Bash`; phase cannot invoke `run_command` even accidentally |
| Prompt injection in TOR could pivot to write | Attacker-crafted TOR could instruct model to call `write_file` on a read-only phase — API blocks this today but no handler guard | Handler filter is second wall |

Path traversal is already protected by `validatePath()` — that is orthogonal to this work.

---

## 5. Implementation Plan (Complexity: Small)

### Task A — Filter handlers at dispatch (5–10 lines)

In `runPhase()`, after line 716, build an allowed-names set from the declared tools:

```ts
const tools    = getToolDefinitions(config.tools);
const handlers = getToolHandlers(config.engagementId, workDir);

// Build allowed handler names from the Anthropic tool definitions
const allowedHandlerNames = new Set(tools.map(t => t.name));
```

Then in the dispatch block (line 848), replace:
```ts
const handler = handlers[block.name];
```
with:
```ts
const handler = allowedHandlerNames.has(block.name) ? handlers[block.name] : undefined;
```

This means: even if Claude somehow requests a tool not in its definitions, the handler
will not run.

### Task B — Remove Bash from Phase 1A estimate (1 line)

In `phase1a-estimate.ts` line 46, change:
```ts
tools: ["Read", "Write", "Glob", "Grep", "Bash"],
```
to:
```ts
tools: ["Read", "Write", "Glob", "Grep"],
```

### Task C — Split system prompt into two cache_control blocks (3 lines)

In `agent.ts` around line 755, replace:
```ts
system: [{ type: "text" as const, text: enrichedSystemPrompt, cache_control: { type: "ephemeral" } }],
```
with:
```ts
system: [
  { type: "text" as const, text: baseSystemPrompt },
  { type: "text" as const, text: benchmarks + template, cache_control: { type: "ephemeral" } },
],
```

This caches only the stable benchmarks+template block. `baseSystemPrompt` varies per
engagement (techStack), so caching it independently gives less value — omit its
`cache_control` or add it if the same techStack is reused within the 5-minute TTL window.

If cross-engagement benchmark caching is the goal, put `cache_control` on the second block
only. If same-session multi-turn caching (current goal) is sufficient, putting it on both
blocks works but the first block cache will only hit when techStack is identical.

---

## 6. Summary Table

| Sub-item | Finding | Action | Complexity |
|----------|---------|--------|-----------|
| Handler gap | `getToolHandlers` always returns all 7 handlers; only API definitions are filtered | Add `allowedHandlerNames` set at dispatch | Small (5 lines) |
| Phase 1A over-declaration | `Bash` declared but not needed for estimation | Remove `"Bash"` from tools array | Trivial (1 char) |
| All other phases | Tool declarations match phase intent | No change needed | — |
| Benchmark caching | Currently works (single block, stable string) | Split into two blocks for cross-engagement cache hit on benchmarks | Small (3 lines) |
| Token cost of benchmarks | ~8,000 tokens disk / 2,000–5,000 tokens DB | Caching already mitigates this; split blocks improves hit rate | — |
