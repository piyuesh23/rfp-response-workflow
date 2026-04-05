# Plan: Browser Notifications for Phase Completion

## Requirements Summary

Users need to be notified when a phase finishes (transitions to REVIEW or FAILED) without watching the page. The existing SSE stream already delivers `done`/`error` events to connected browsers. The existing server-side notifications (Slack/Email) are external-only.

## Acceptance Criteria

- [ ] AC1: When a phase completes (SSE `done` event), the browser shows a native notification with phase name and "Ready for review" message
- [ ] AC2: When a phase fails (SSE `error` event), the browser shows a notification with phase name and error context
- [ ] AC3: Clicking the notification navigates the user to the phase detail page
- [ ] AC4: Tab title flashes "Phase X complete - QED42 Presales" when the page is not focused, reverting when focused
- [ ] AC5: Notification permission is requested once via a non-intrusive prompt (not on page load - only when user first triggers a phase run)
- [ ] AC6: Users who deny permission still get tab title flashing (graceful degradation)
- [ ] AC7: Notifications work even when the user navigates away from the engagement page (but stays in the app)

---

## Approach: Browser Notification API + SSE (No Service Worker)

### Why NOT Service Workers / Web Push

Service Workers + Web Push API would enable notifications even when the app is fully closed. However:
- Requires a push notification server (VAPID keys, subscription management, push endpoint)
- Requires a `manifest.json` and PWA setup
- Adds significant infrastructure (subscription DB, web-push npm package, push endpoint)
- The presales tool is used during active work sessions - users have the tab open

The **Browser Notification API triggered by SSE** is the right fit because:
- Zero infrastructure: hooks into the existing SSE stream
- Works when tab is backgrounded (which is the main problem)
- 5 lines of code to show a notification
- Graceful degradation to tab title flashing

### Architecture

```
Phase completes -> SSE 'done' event -> Browser EventSource listener
                                        |
                                        +-> new Notification("Phase 1 complete")
                                        +-> document.title = "(*) Phase 1 complete"
```

---

## Implementation Steps

### Step 1: Create notification hook
**New file:** `tool/src/hooks/usePhaseNotifications.ts`

A React hook that:
- Accepts `engagementId`, `phaseId`, `phaseNumber`, `phaseLabel`
- Opens an SSE connection to `/api/phases/{phaseId}/sse`
- On `done` event: fires browser Notification + updates tab title
- On `error` event: fires browser Notification with error styling
- Cleans up EventSource on unmount
- Handles Notification permission state (granted/denied/default)

```typescript
export function usePhaseNotifications({
  phaseId,
  engagementId,
  phaseNumber,
  phaseLabel,
  enabled,
}: PhaseNotificationOptions) {
  // Only activate when a phase is RUNNING
  // Listen to SSE done/error events
  // Show Notification + flash tab title
}
```

### Step 2: Create tab title flash utility
**New file:** `tool/src/lib/tab-title.ts`

Simple utility:
- `flashTitle(message: string)`: Alternates document.title between message and original title every 1.5s
- `restoreTitle()`: Restores original title, called on `window.focus`
- Auto-stops flashing when window regains focus

### Step 3: Create notification permission prompt component
**New file:** `tool/src/components/ui/NotificationPermission.tsx`

A small inline banner shown on the engagement overview page when:
- `Notification.permission === "default"` (never asked)
- A phase is about to run or is running

Renders as a subtle info bar: "Enable browser notifications to get alerted when phases complete." with [Enable] and [Dismiss] buttons. Not a modal - non-intrusive.

### Step 4: Wire into engagement overview page
**File:** `tool/src/app/engagements/[id]/page.tsx` (lines 136-148)

The existing SSE listener already connects when a phase is RUNNING. Modify it to:
1. Import and use `usePhaseNotifications` hook alongside existing SSE refresh logic
2. On `done`: show notification + flash title + refresh engagement data (existing behavior)
3. On `error`: show notification + flash title + refresh

The notification click handler navigates to `/engagements/{id}/phases/{phaseNumber}`.

### Step 5: Wire into phase detail page
**File:** `tool/src/app/engagements/[id]/phases/[phase]/page.tsx`

If the user is on the phase detail page watching progress, still show notification when `done`/`error` fires (user may have tabbed away).

### Step 6: Request permission on phase run
**File:** `tool/src/components/phase/RunPhaseButton.tsx`

Before triggering the phase run, request Notification permission if it's `"default"`:
```typescript
if (Notification.permission === "default") {
  await Notification.requestPermission();
}
```

This ties permission to a user action (clicking Run), avoiding the annoying "allow notifications?" popup on page load.

---

## Notification Content

**Phase complete:**
```
Title: "Phase 1: TOR Assessment complete"
Body: "Ready for review. Click to open."
Icon: /favicon.ico (or app icon)
Tag: "phase-{phaseId}" (prevents duplicates)
```

**Phase failed:**
```
Title: "Phase 1A: Optimistic Estimate failed"
Body: "An error occurred during execution."
Tag: "phase-{phaseId}"
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User denies notification permission | Tab title flashing works without any permission |
| SSE disconnects before phase completes (10min timeout) | Existing SSE reconnection logic handles this; engagement page polls on reconnect |
| Multiple tabs open for same engagement | Use `tag` parameter on Notification to deduplicate |
| iOS Safari doesn't support Notification API | Tab title flashing as universal fallback |
| User not on the engagement page when phase completes | AC7 addressed via app-level SSE listener (Step 7 below) |

### Step 7 (Optional/Future): App-level phase monitor
**File:** `tool/src/components/layout/AppShell.tsx`

For AC7 (notifications when navigated away from engagement page), add an app-level SSE monitor:
- Fetch all RUNNING phases for the current user on app mount
- Open SSE connections for each
- Show notifications regardless of which page the user is on
- This is optional for v1 - the engagement page covers the primary use case

---

## Verification Steps

1. Start a phase run -> navigate to a different tab -> wait for completion -> verify browser notification appears
2. Click the notification -> verify it navigates to the correct phase detail page
3. Start a phase run -> stay on engagement page but switch to different browser tab -> verify tab title flashes
4. Focus the tab -> verify title stops flashing and reverts to normal
5. Deny notification permission -> verify tab title still flashes on completion
6. Open engagement in two tabs -> verify only one notification (not duplicate)
7. Start a phase that will fail -> verify error notification appears

---

## Implementation Order

1. Step 2 (tab-title.ts) - simplest, no dependencies
2. Step 1 (usePhaseNotifications hook) - core logic
3. Step 6 (permission request on Run click) - simple one-liner
4. Step 4 (wire into engagement overview) - integration
5. Step 5 (wire into phase detail) - integration
6. Step 3 (permission prompt component) - polish
7. Step 7 (app-level monitor) - optional future enhancement
