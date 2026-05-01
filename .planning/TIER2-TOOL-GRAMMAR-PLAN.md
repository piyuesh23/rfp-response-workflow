---
phase: tier2-tool-grammar
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tool/src/lib/ai/agent.ts
  - tool/src/lib/ai/phases/phase1a-estimate.ts
autonomous: true
requirements: [TOOL-GRAMMAR-A, TOOL-GRAMMAR-B, TOOL-GRAMMAR-C]
must_haves:
  truths:
    - "A phase that declares only Read/Glob cannot execute write_file even if Claude names it"
    - "Phase 1A estimation cannot invoke any shell commands (run_command handler blocked)"
    - "The benchmark+template text is in its own system block with cache_control; baseSystemPrompt is in a separate block without cache_control"
  artifacts:
    - path: "tool/src/lib/ai/agent.ts"
      provides: "Filtered handler dispatch and split system array"
      contains: "allowedHandlerNames"
    - path: "tool/src/lib/ai/phases/phase1a-estimate.ts"
      provides: "Corrected tool declaration without Bash"
  key_links:
    - from: "agent.ts line ~716"
      to: "handlers[block.name] dispatch at line ~848"
      via: "allowedHandlerNames set built from tools.map(t => t.name)"
      pattern: "allowedHandlerNames\\.has\\(block\\.name\\)"
    - from: "agent.ts enrichedSystemPrompt assembly"
      to: "both stream() calls (line ~755 and ~892)"
      via: "two-element system array"
      pattern: "system: \\[.*baseSystemPrompt.*benchmarks"
---

<objective>
Tighten agent.ts tool grammar with three minimal, targeted changes:

A. Filter the handler map to declared tools only — defense-in-depth against handler-side bypass.
B. Split the single-block system array into two blocks so the stable benchmarks+template text
   can cache independently of the per-engagement baseSystemPrompt.
C. Remove the unnecessary Bash declaration from Phase 1A estimation config.

Purpose: Close the handler-bypass gap, enable cross-engagement prompt-cache hits on ~8,000
tokens of benchmark text, and shrink the tool surface for the estimation phase.

Output: Modified agent.ts and phase1a-estimate.ts. All other phase files untouched.
</objective>

<execution_context>
@/Users/piyuesh23/.claude/get-shit-done/workflows/execute-plan.md
@/Users/piyuesh23/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/piyuesh23/Operational/presales/_template/.planning/TIER2-TOOL-GRAMMAR-RESEARCH.md

@tool/src/lib/ai/agent.ts
@tool/src/lib/ai/tools.ts
@tool/src/lib/ai/phases/phase1a-estimate.ts

<interfaces>
<!-- Key contracts the executor needs. No codebase exploration required. -->

From tools.ts (getToolHandlers return shape):
```typescript
// Returns plain object with exactly these 7 keys (no filtering):
{
  read_file:      ToolHandler,
  write_file:     ToolHandler,
  list_files:     ToolHandler,
  search_content: ToolHandler,
  web_fetch:      ToolHandler,
  web_search:     ToolHandler,
  run_command:    ToolHandler,
}
```

From tools.ts (getToolDefinitions):
```typescript
// Returns Anthropic.Tool[] whose .name values match the handler keys above.
// Called with config.tools — the human-readable names like "Read", "Bash", etc.
// The resulting tools[].name values are the snake_case handler keys.
export function getToolDefinitions(toolNames: string[]): Anthropic.Tool[];
```

From agent.ts (variable names available at the two stream() call sites):
```typescript
// Assembled at line 702:
const enrichedSystemPrompt = baseSystemPrompt + benchmarks + template;
// Both individual parts are in scope at the stream() call sites:
//   baseSystemPrompt  — string, per-engagement (contains techStack interpolation)
//   benchmarks        — string, global/stable, ~8,000 tokens from disk files
//   template          — string, from PromptConfig or empty
// The stream() calls are at:
//   Line ~755 (main agentic loop call)
//   Line ~892 (max-turns fallback call)
```

From phase1a-estimate.ts (line 46):
```typescript
tools: ["Read", "Write", "Glob", "Grep", "Bash"],
// Remove "Bash" → tools: ["Read", "Write", "Glob", "Grep"]
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task A: Add allowedHandlerNames filter to handler dispatch</name>
  <files>tool/src/lib/ai/agent.ts</files>
  <action>
After line 716 (after `const handlers = getToolHandlers(config.engagementId, workDir);`),
add one line:

```typescript
const allowedHandlerNames = new Set(tools.map((t) => t.name));
```

Then at line ~848, replace:
```typescript
const handler = handlers[block.name];
```
with:
```typescript
const handler = allowedHandlerNames.has(block.name) ? handlers[block.name] : undefined;
```

The Set is built from the already-filtered `tools` array (which getToolDefinitions returned
for only the declared tools). The handler keys are identical snake_case names used by both
getToolDefinitions and getToolHandlers — no mapping required.

Do NOT change getToolHandlers, getToolDefinitions, or any phase config other than
phase1a-estimate.ts (covered in Task B).
  </action>
  <verify>
    <automated>cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:unit 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `allowedHandlerNames` variable exists in runPhase() scope after handlers line
    - Handler dispatch uses `allowedHandlerNames.has(block.name)` guard
    - `npm run test:unit` passes
  </done>
</task>

<task type="auto">
  <name>Task B+C: Split system array and remove Bash from Phase 1A</name>
  <files>tool/src/lib/ai/agent.ts, tool/src/lib/ai/phases/phase1a-estimate.ts</files>
  <action>
**In agent.ts — two locations (both stream() calls):**

Replace both occurrences of:
```typescript
system: [{ type: "text" as const, text: enrichedSystemPrompt, cache_control: { type: "ephemeral" } }],
```
with:
```typescript
system: [
  { type: "text" as const, text: baseSystemPrompt },
  { type: "text" as const, text: benchmarks + template, cache_control: { type: "ephemeral" } },
],
```

First occurrence is at line ~755 (inside the main while-loop stream call).
Second occurrence is at line ~892 (inside the max-turns fallback stream call).

Both `baseSystemPrompt` and `benchmarks` and `template` are already in scope at both call
sites (they are assembled at line 702 before the loop begins). The variable `enrichedSystemPrompt`
can remain as-is (it is still used in the progress message at line 711 — do not delete it).

**In phase1a-estimate.ts — one location (line 46):**

Change:
```typescript
tools: ["Read", "Write", "Glob", "Grep", "Bash"],
```
to:
```typescript
tools: ["Read", "Write", "Glob", "Grep"],
```

That is the complete scope of this task.
  </action>
  <verify>
    <automated>cd /Users/piyuesh23/Operational/presales/_template/tool && npm run test:unit && npm run test:integration 2>&1 | tail -30</automated>
  </verify>
  <done>
    - Both stream() calls in agent.ts use the two-block system array
    - The second block (benchmarks + template) carries cache_control; the first does not
    - phase1a-estimate.ts tools array contains exactly ["Read", "Write", "Glob", "Grep"]
    - `npm run test:unit` and `npm run test:integration` both pass
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. Grep agent.ts for `enrichedSystemPrompt` in system array — should return 0 results in stream() calls
2. Grep agent.ts for `allowedHandlerNames` — should appear twice (declaration + use)
3. Grep phase1a-estimate.ts for `"Bash"` — should return 0 results
4. Both test suites green: `npm run test:unit` + `npm run test:integration`
</verification>

<success_criteria>
- Handler dispatch is gated by `allowedHandlerNames.has(block.name)` — phases that don't declare Write cannot accidentally execute write_file
- Phase 1A estimation config has no Bash/run_command in its tool list
- Both anthropic.messages.stream() calls use a two-element system array: [baseSystemPrompt (no cache), benchmarks+template (ephemeral cache)]
- `enrichedSystemPrompt` variable still exists (used in progress message) but is no longer the system array value
- All unit and integration tests pass with no modifications to test files
</success_criteria>

<output>
After completion, create `.planning/phases/tier2-tool-grammar/tier2-tool-grammar-01-SUMMARY.md`
with: changes made (file + line), test results, and confirmation of the three acceptance criteria.
</output>
