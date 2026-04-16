"use client";

import * as React from "react";
import { AccuracyTabs, type AccuracyTabDef } from "./AccuracyTabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Phase5Summary {
  status: "PASS" | "WARN" | "FAIL";
  missingRequirements: number;
  missingTiers: number;
  unmappedObjectives: number;
}

interface AccuracyDrilldownProps {
  tabs: AccuracyTabDef[];
  phase5?: Phase5Summary | null;
  /**
   * Tab values used by the Phase 5 block's clickable rows.
   * Falls back to `"proposal"` and `"integrations"` if omitted.
   */
  proposalTabValue?: string;
  integrationsTabValue?: string;
  defaultValue?: string;
}

function statusBadgeVariant(
  status: "PASS" | "WARN" | "FAIL"
): "default" | "secondary" | "destructive" {
  if (status === "PASS") return "default";
  if (status === "WARN") return "secondary";
  return "destructive";
}

function countTone(n: number): string {
  return n === 0
    ? "text-green-600 dark:text-green-500"
    : "text-destructive";
}

export function AccuracyDrilldown({
  tabs,
  phase5,
  proposalTabValue = "proposal",
  integrationsTabValue = "integrations",
  defaultValue,
}: AccuracyDrilldownProps) {
  const [value, setValue] = React.useState<string>(
    defaultValue ?? tabs[0]?.value ?? "gaps"
  );

  return (
    <div className="flex flex-col gap-4">
      {phase5 ? (
        <section
          aria-labelledby="phase5-summary-heading"
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-2">
            <h2
              id="phase5-summary-heading"
              className="font-heading text-base font-semibold"
            >
              Phase 5 Proposal Review
            </h2>
            <Badge variant={statusBadgeVariant(phase5.status)}>
              {phase5.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setValue(proposalTabValue)}
              className="flex flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Requirements missing from proposal
              </span>
              <span
                className={cn(
                  "font-mono text-2xl font-bold tabular-nums",
                  countTone(phase5.missingRequirements)
                )}
              >
                {phase5.missingRequirements}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setValue(integrationsTabValue)}
              className="flex flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Integration tier misses in proposal
              </span>
              <span
                className={cn(
                  "font-mono text-2xl font-bold tabular-nums",
                  countTone(phase5.missingTiers)
                )}
              >
                {phase5.missingTiers}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setValue(proposalTabValue)}
            className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Unmapped proposal objectives
            </span>
            <span
              className={cn(
                "font-mono text-lg font-bold tabular-nums",
                countTone(phase5.unmappedObjectives)
              )}
            >
              {phase5.unmappedObjectives}
            </span>
          </button>

          <p className="text-xs text-muted-foreground">
            These are separate from the Phase 1A estimate gaps above. They
            check whether the generated proposal markdown aligns with the TOR.
          </p>
        </section>
      ) : null}

      <AccuracyTabs tabs={tabs} value={value} onValueChange={setValue} />
    </div>
  );
}
