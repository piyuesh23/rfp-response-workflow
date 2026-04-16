import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SectionEmpty } from "./SectionEmpty";

// ─── Assumptions ──────────────────────────────────────────────────────────────

export interface AssumptionDefectRow {
  id: string;
  textPreview: string;
  missing: Array<"tor-reference" | "impact-if-wrong">;
}

export function AssumptionDefectTable({
  defects,
}: {
  defects: AssumptionDefectRow[];
}) {
  if (defects.length === 0) {
    return (
      <SectionEmpty message="No assumption defects — every assumption cites a TOR/Q&A reference and has an Impact-if-wrong clause." />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Text Preview</TableHead>
            <TableHead className="w-[260px]">Missing</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {defects.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="whitespace-normal text-xs">
                {d.textPreview}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {d.missing.map((m) => (
                    <Badge key={m} variant="destructive">
                      {m === "tor-reference" ? "No TOR ref" : "No Impact-if-wrong"}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Risks ────────────────────────────────────────────────────────────────────

export interface RiskIssueRow {
  kind: "MISSING_ENTRY" | "BLANK_FIELD";
  id: string;
  task: string;
  conf?: number;
  missingField?: "openQuestion" | "recommendedAction";
}

export function RiskIssueTable({ issues }: { issues: RiskIssueRow[] }) {
  if (issues.length === 0) {
    return (
      <SectionEmpty message="Risk register is complete — every Conf ≤ 4 line item has a matched risk entry with populated openQuestion and recommendedAction." />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Issue</TableHead>
            <TableHead>Task</TableHead>
            <TableHead className="w-[80px] text-right">Conf</TableHead>
            <TableHead className="w-[220px]">Missing Field</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((r) => (
            <TableRow key={`${r.kind}-${r.id}-${r.missingField ?? "none"}`}>
              <TableCell>
                <Badge
                  variant={
                    r.kind === "MISSING_ENTRY" ? "destructive" : "secondary"
                  }
                >
                  {r.kind === "MISSING_ENTRY"
                    ? "No risk entry"
                    : "Blank field"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-normal">{r.task}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {r.conf ?? "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.missingField ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Integration Tier ─────────────────────────────────────────────────────────

export interface IntegrationTierIssueRow {
  kind: "NO_TIER" | "PROPOSAL_MISS";
  requirementId: string;
  clauseRef: string;
  title: string;
  estimateTier?: string;
}

export function IntegrationTierIssueTable({
  issues,
}: {
  issues: IntegrationTierIssueRow[];
}) {
  if (issues.length === 0) {
    return (
      <SectionEmpty message="All integrations are tiered (T1/T2/T3) and referenced in the proposal." />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Issue</TableHead>
            <TableHead className="w-[120px]">Clause</TableHead>
            <TableHead>Integration</TableHead>
            <TableHead className="w-[120px]">Estimate Tier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((i) => (
            <TableRow key={`${i.kind}-${i.requirementId}`}>
              <TableCell>
                <Badge
                  variant={i.kind === "NO_TIER" ? "destructive" : "secondary"}
                >
                  {i.kind === "NO_TIER"
                    ? "No T1/T2/T3"
                    : "Tier missing in proposal"}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{i.clauseRef}</TableCell>
              <TableCell className="whitespace-normal">{i.title}</TableCell>
              <TableCell className="font-mono text-xs">
                {i.estimateTier ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Proposal Objective ───────────────────────────────────────────────────────

export interface ProposalObjectiveIssueRow {
  kind: "UNMAPPED_OBJECTIVE" | "MISSING_REQUIREMENT";
  key: string;
  preview: string;
  clauseRef?: string;
}

export function ProposalObjectiveIssueTable({
  issues,
  note,
}: {
  issues: ProposalObjectiveIssueRow[];
  note?: string;
}) {
  if (issues.length === 0) {
    return (
      <SectionEmpty
        message={
          note ??
          "No proposal objective issues detected. Run Phase 4/5 to refresh coverage."
        }
      />
    );
  }

  return (
    <div className="rounded-xl border ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[240px]">Issue</TableHead>
            <TableHead className="w-[120px]">Clause</TableHead>
            <TableHead>Preview</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((p) => (
            <TableRow key={p.key}>
              <TableCell>
                <Badge
                  variant={
                    p.kind === "MISSING_REQUIREMENT"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {p.kind === "MISSING_REQUIREMENT"
                    ? "TOR req missing from proposal"
                    : "Proposal objective not in TOR"}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {p.clauseRef ?? "—"}
              </TableCell>
              <TableCell className="whitespace-normal text-xs">
                {p.preview}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
