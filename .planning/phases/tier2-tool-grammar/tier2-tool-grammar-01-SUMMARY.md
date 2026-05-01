---
phase: tier2-tool-grammar
plan: 01
status: COMPLETE
---

# Summary: Tier 2 Tool Grammar Tightening

## Changes Made

### tool/src/lib/ai/agent.ts

**Line 717** — Added `allowedHandlerNames` Set immediately after handler map construction:
```typescript
const allowedHandlerNames = new Set(tools.map((t) => t.name));
```

**Line 852** — Handler dispatch now gated through the Set:
```typescript
const handler = allowedHandlerNames.has(block.name) ? handlers[block.name] : undefined;
```
The existing `if (!handler)` branch handles the blocked case with the existing error message.

**Lines 755-760 and 892-897** — Both `anthropic.messages.stream()` calls now use a two-element system array:
```typescript
system: [
  { type: "text" as const, text: baseSystemPrompt },
  { type: "text" as const, text: benchmarks + template, cache_control: { type: "ephemeral" } },
],
```
`enrichedSystemPrompt` still exists on line 702 (used in the progress message at line 711) but is no longer passed to the API.

### tool/src/lib/ai/phases/phase1a-estimate.ts

**Line 46** — Removed `"Bash"` from Phase 1A tool declaration:
```typescript
tools: ["Read", "Write", "Glob", "Grep"],
```

## Test Results

```
Unit:        4 files, 18 tests — PASS
Integration: 4 files,  8 tests — PASS
```

## Acceptance Criteria

- [x] Handler dispatch gated by `allowedHandlerNames.has(block.name)` — phases that don't declare Write cannot execute write_file
- [x] Phase 1A estimation config has no Bash/run_command
- [x] Both stream() calls use two-element system array: baseSystemPrompt (no cache) + benchmarks+template (ephemeral)
- [x] `enrichedSystemPrompt` variable still exists but is no longer the system array value
- [x] All unit and integration tests pass
