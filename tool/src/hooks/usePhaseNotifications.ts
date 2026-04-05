"use client";

import * as React from "react";
import { flashTitle } from "@/lib/tab-title";

interface UsePhaseNotificationsOptions {
  /** Phase DB ID (for SSE connection) */
  phaseId: string | null;
  /** Engagement ID (for navigation on click) */
  engagementId: string;
  /** Phase number (e.g., "0", "1", "1A") */
  phaseNumber: string;
  /** Human-readable phase label */
  phaseLabel: string;
  /** Only activate when true (i.e., phase is RUNNING) */
  enabled: boolean;
  /** Called when phase completes */
  onComplete?: () => void;
  /** Called when phase fails */
  onError?: () => void;
}

/**
 * Hook that listens to phase SSE events and shows browser notifications
 * + tab title flashing when a phase completes or fails.
 */
export function usePhaseNotifications({
  phaseId,
  engagementId,
  phaseNumber,
  phaseLabel,
  enabled,
  onComplete,
  onError,
}: UsePhaseNotificationsOptions): void {
  React.useEffect(() => {
    if (!enabled || !phaseId) return;

    const eventSource = new EventSource(`/api/phases/${phaseId}/sse`);

    function handleDone() {
      eventSource.close();

      const title = `Phase ${phaseNumber}: ${phaseLabel} complete`;
      const body = "Ready for review. Click to open.";

      // Flash tab title
      flashTitle(title);

      // Browser notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          tag: `phase-${phaseId}`,
          icon: "/favicon.ico",
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = `/engagements/${engagementId}/phases/${phaseNumber}`;
          notification.close();
        };
      }

      onComplete?.();
    }

    function handleError(event: Event) {
      eventSource.close();

      const title = `Phase ${phaseNumber}: ${phaseLabel} failed`;
      const body = "An error occurred during execution.";

      // Flash tab title
      flashTitle(title);

      // Browser notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          tag: `phase-${phaseId}`,
          icon: "/favicon.ico",
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = `/engagements/${engagementId}/phases/${phaseNumber}`;
          notification.close();
        };
      }

      onError?.();
    }

    eventSource.addEventListener("done", handleDone);
    eventSource.addEventListener("error", handleError);

    return () => {
      eventSource.close();
    };
  }, [enabled, phaseId, engagementId, phaseNumber, phaseLabel, onComplete, onError]);
}

/**
 * Request notification permission if not yet decided.
 * Call this on a user action (e.g., clicking "Run Phase") to avoid
 * annoying permission prompts on page load.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof Notification === "undefined") return null;
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
