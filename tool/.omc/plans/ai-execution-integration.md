# Plan: Integrate Real AI Execution into Phase Runner

## Requirements Summary

Replace the stub `runPhase()` in `src/lib/ai/agent.ts` with a real Claude API integration that:
- Calls the Anthropic Messages API with tool_use in an agentic loop
- Executes per-phase prompts (already written in `src/lib/ai/prompts/`)
- Provides tool handlers for file ops, search, and web access
- Streams progress events back through the existing BullMQ worker
- Saves the final AI-generated markdown as artefacts

## Architecture Decision

**Approach**: Anthropic Messages API with tool_use (agentic loop), NOT the Agent SDK.

**Why**: The Agent SDK is designed for long-running autonomous agents with its own execution model. Our use case is simpler — a single conversation turn with tool calls, bounded by `maxTurns`. The Messages API with `tool_use` gives us full control over the loop, progress events, and error handling within the existing BullMQ worker.

## Acceptance Criteria

1. `npm install @anthropic-ai/sdk` succeeds and is in package.json
2. `runPhase()` calls Claude API with the phase's system/user prompts
3. Tool calls (Read, Write, Glob, Grep, WebSearch) execute against the engagement directory
4. Each tool call emits a `ProgressEvent` visible in the worker log
5. The final assistant response (markdown) is yielded as the `complete` event
6. Phase 0 (Research) produces real research output when a TOR file exists in MinIO
7. `maxTurns` is respected — loop terminates after config.maxTurns tool rounds
8. API errors and tool errors are caught and yielded as `error` events
9. `ANTHROPIC_API_KEY` env var is required; missing key fails fast with clear error
10. Existing worker (`phase-runner.ts`) works unchanged — only `agent.ts` changes

## Implementation Steps

### Step 1: Install Anthropic SDK
**File**: `package.json`
- Run `npm install @anthropic-ai/sdk`
- Verify import works

### Step 2: Implement tool definitions
**File**: `src/lib/ai/tools.ts` (new)
- Define Anthropic tool schemas for each tool the phases use:
  - `read_file` — Read a file from the engagement directory or MinIO
  - `write_file` — Write a file to the engagement directory
  - `list_files` — Glob pattern matching in engagement directory
  - `search_content` — Grep-style search in engagement directory
  - `web_search` — Web search via a search API (or stub with clear TODO)
  - `web_fetch` — Fetch a URL and return content
- Each tool handler:
  - Validates inputs (path traversal protection — must stay within `/data/engagements/{engagementId}/`)
  - Executes the operation
  - Returns result string

**Tool mapping from phase configs**:
| Phase Config Tool | Anthropic Tool Name | Implementation |
|---|---|---|
| `Read` | `read_file` | `fs.readFile` on engagement dir + MinIO `downloadFile` for TOR |
| `Write` | `write_file` | `fs.writeFile` to engagement dir |
| `Glob` | `list_files` | `glob` package on engagement dir |
| `Grep` | `search_content` | `execFile('grep', [...args])` on engagement dir (safe — no shell) |
| `WebSearch` | `web_search` | Stub returning "not available" (requires external API key) |
| `WebFetch` | `web_fetch` | `fetch()` with timeout + HTML-to-text extraction |
| `Bash` | `run_command` | `execFile` with explicit arg array, sandboxed to engagement dir |

**Security**: All file operations use `path.resolve()` + startsWith check against engagement base dir. Command execution uses `execFile` (not `exec`) to prevent shell injection.

### Step 3: Implement the agentic loop in runPhase()
**File**: `src/lib/ai/agent.ts`
- Replace stub with real implementation:

```
Flow:
1. Create Anthropic client (uses ANTHROPIC_API_KEY env var)
2. Prepare engagement directory via prepareWorkDir()
3. Sync TOR files from MinIO to local workDir/tor/
4. Build tool definitions filtered by config.tools
5. Call Messages API with system prompt, user prompt, and tools
6. Loop: if response has tool_use blocks, execute them, yield progress, append results
7. Loop terminates when: stop_reason === "end_turn" (no more tool calls) or maxTurns hit
8. Extract final text content, yield as "complete" event
```

Key implementation details:
- Model: `claude-sonnet-4-20250514` (configurable via `CLAUDE_MODEL` env var)
- max_tokens: 16384 per turn
- Tool results appended as proper `tool_result` message blocks
- On maxTurns reached: send one final turn asking for summary without tools
- All API errors caught and yielded as `error` events

### Step 4: Sync TOR files from MinIO to local disk
**File**: `src/lib/ai/agent.ts` (add helper)
- Before running a phase, download TOR files from MinIO to `/data/engagements/{id}/tor/`
- Uses S3 ListObjectsV2 to discover files with prefix `engagements/{id}/tor/`
- Uses existing `downloadFile()` from `src/lib/storage.ts`
- This gives the AI agent local filesystem access to the TOR (matching the prompts' expectations)
- Graceful fallback: if MinIO unavailable or no TOR uploaded, yield warning and continue

### Step 5: Wire SSE endpoint to real BullMQ progress
**File**: `src/app/api/phases/[id]/sse/route.ts`
- Replace stub with real BullMQ job progress subscription
- Subscribe to job progress events via `QueueEvents`
- Forward `ProgressEvent` objects as SSE data
- Close stream on `completed` or `failed` events

### Step 6: Model selection
- Default: `claude-sonnet-4-20250514` (good balance of speed/quality/cost)
- Override via `CLAUDE_MODEL` env var for testing or upgrading
- Phase configs already have `maxTurns` set appropriately per phase complexity

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| API key missing/invalid | Phase fails immediately | Validate key on worker startup, clear error message |
| Tool execution escapes engagement dir | Security vulnerability | Path validation: all file ops must resolve within `/data/engagements/{id}/`; use `execFile` not `exec` |
| Claude generates malformed markdown | Bad artefact display | Existing rehype-sanitize handles this; ArtefactViewer already XSS-safe |
| Long-running phases exceed API limits | Timeout/cost | `maxTurns` bounds the loop; Sonnet is cost-efficient |
| WebSearch unavailable (no API key) | Phase 0 incomplete | Stub returns "web search unavailable" — phase still produces analysis from TOR |
| MinIO not running (local dev) | TOR files missing | Graceful fallback: check if files exist, yield warning if tor/ empty |
| Large TOR documents exceed context | Truncated analysis | Chunk large files, or use Read tool with offset/limit params |

## Verification Steps

1. Create engagement, upload a TOR PDF/doc to MinIO
2. Run Phase 0 — verify real research output (not placeholder)
3. Check artefact in DB has real markdown content
4. Approve Phase 0, run Phase 1 — verify TOR analysis references the actual document
5. Check SSE endpoint streams real progress events during execution
6. Verify `maxTurns` limit stops runaway loops
7. Test with missing API key — should fail fast with clear message
8. Test path traversal attempt in tool call — should be blocked

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `package.json` | modify | Add `@anthropic-ai/sdk` dependency |
| `src/lib/ai/agent.ts` | rewrite | Real agentic loop replacing stub |
| `src/lib/ai/tools.ts` | **new** | Tool definitions and handlers |
| `src/app/api/phases/[id]/sse/route.ts` | rewrite | Real BullMQ progress subscription |
| `.env.example` | modify | Document `CLAUDE_MODEL` env var |
