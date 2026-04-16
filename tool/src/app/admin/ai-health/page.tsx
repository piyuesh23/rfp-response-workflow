import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 8 ? id.slice(0, 8) : id;
}

function truncate(text: string | null, max = 80): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const classes =
    outcome === "PASS"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : outcome === "FAIL"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
        : outcome === "RETRIED_OK"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
          : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("border-transparent", classes)}>
      {outcome}
    </Badge>
  );
}

export default async function AiHealthPage() {
  await requireAdmin();

  const rows = await prisma.aiCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">AI Call Health</h1>
        <p className="text-sm text-muted-foreground">
          Last 20 Anthropic calls with validation outcomes and token usage.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No AI calls logged yet. Logs appear here after `aiJsonCall` runs.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">In Tokens</TableHead>
              <TableHead className="text-right">Out Tokens</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="text-right">Retries</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  {formatTimestamp(row.createdAt)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {shortId(row.engagementId)}
                </TableCell>
                <TableCell className="text-xs">{row.phase ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.model}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.inputTokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.outputTokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.durationMs}ms
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {row.retryCount}
                </TableCell>
                <TableCell>
                  <OutcomeBadge outcome={row.validationOutcome} />
                </TableCell>
                <TableCell
                  className="max-w-[320px] text-xs text-muted-foreground"
                  title={row.errorMessage ?? undefined}
                >
                  {truncate(row.errorMessage, 80)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
