import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatAuditFilterBar } from "@/components/admin/ChatAuditFilterBar";

const PAGE_SIZE = 100;
const RANGE_WINDOWS: Record<string, number | null> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  all: null,
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeRangeStart(rangeMs: number | null): Date | null {
  if (!rangeMs) return null;
  return new Date(Date.now() - rangeMs);
}

function last24hStart(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export default async function ChatAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const scopeParam = firstParam(params.scope);
  const rangeParam = firstParam(params.range) ?? "24h";
  const qParam = firstParam(params.q)?.trim() ?? "";
  const cursorParam = firstParam(params.cursor);

  // Build WHERE clause for table listing (respects all filters).
  const rangeMs = RANGE_WINDOWS[rangeParam] ?? null;
  const rangeStart = computeRangeStart(rangeMs);

  const where: Prisma.ChatAuditLogWhereInput = {};
  if (scopeParam === "ENGAGEMENT" || scopeParam === "ADMIN") {
    where.scope = scopeParam;
  }
  if (rangeStart) {
    where.createdAt = { gte: rangeStart };
  }
  if (qParam) {
    where.question = { contains: qParam, mode: "insensitive" };
  }
  if (cursorParam) {
    const cursorDate = new Date(cursorParam);
    if (!Number.isNaN(cursorDate.getTime())) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter | undefined),
        lt: cursorDate,
      };
    }
  }

  // 24h window for the summary cards — independent of user filters.
  const last24h = last24hStart();

  // Parallel: rows + aggregates for summary tiles.
  const [rows, totalTurns24h, uniqueUserAgg, tokenSumAgg, scopeGroups] =
    await Promise.all([
      prisma.chatAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
      }),
      // Summary Tile 1: Total turns in last 24h (respects scope filter so
      //   the "split" tile stays consistent; count across all scopes).
      prisma.chatAuditLog.count({ where: { createdAt: { gte: last24h } } }),
      // Summary Tile 2: Unique users in last 24h (distinct userId count).
      prisma.chatAuditLog.findMany({
        where: { createdAt: { gte: last24h } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      // Summary Tile 3: Total tokens in last 24h for avg computation.
      prisma.chatAuditLog.aggregate({
        where: { createdAt: { gte: last24h } },
        _sum: { tokensIn: true, tokensOut: true },
        _count: { _all: true },
      }),
      // Summary Tile 4: Per-scope counts for ENGAGEMENT vs ADMIN split.
      prisma.chatAuditLog.groupBy({
        by: ["scope"],
        where: { createdAt: { gte: last24h } },
        _count: { _all: true },
      }),
    ]);

  // Fetch related users and engagements in parallel.
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const engagementIds = Array.from(
    new Set(
      rows
        .map((r) => r.engagementId)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  const [users, engagements] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : Promise.resolve([] as Array<{ id: string; email: string }>),
    engagementIds.length
      ? prisma.engagement.findMany({
          where: { id: { in: engagementIds } },
          select: { id: true, clientName: true, projectName: true },
        })
      : Promise.resolve(
          [] as Array<{
            id: string;
            clientName: string;
            projectName: string | null;
          }>
        ),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const engById = new Map(engagements.map((e) => [e.id, e]));

  // Summary metrics.
  const uniqueUsers24h = uniqueUserAgg.length;
  const totalTokens24h =
    (tokenSumAgg._sum.tokensIn ?? 0) + (tokenSumAgg._sum.tokensOut ?? 0);
  const avgTokensPerTurn =
    tokenSumAgg._count._all > 0
      ? Math.round(totalTokens24h / tokenSumAgg._count._all)
      : 0;
  const engagementCount =
    scopeGroups.find((g) => g.scope === "ENGAGEMENT")?._count._all ?? 0;
  const adminCount =
    scopeGroups.find((g) => g.scope === "ADMIN")?._count._all ?? 0;
  const maxScope = Math.max(engagementCount, adminCount, 1);

  // Pagination: next cursor is the last row's createdAt.
  const nextCursor =
    rows.length === PAGE_SIZE
      ? rows[rows.length - 1].createdAt.toISOString()
      : null;

  function buildPageLink(cursor: string | null): string {
    const next = new URLSearchParams();
    if (scopeParam) next.set("scope", scopeParam);
    if (rangeParam && rangeParam !== "24h") next.set("range", rangeParam);
    if (qParam) next.set("q", qParam);
    if (cursor) next.set("cursor", cursor);
    const qs = next.toString();
    return qs ? `/admin/chat-audit?${qs}` : "/admin/chat-audit";
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold">Chat Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Monitor scoped RAG chat usage, refusals, and ungrounded answers.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Total turns</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {totalTurns24h.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Last 24 hours
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Unique users</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {uniqueUsers24h.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Distinct userId in last 24h
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Avg tokens / turn</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {avgTokensPerTurn.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            In + out, last 24h
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Scope split</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <ScopeBar
              label="Engagement"
              count={engagementCount}
              max={maxScope}
              colorClass="bg-blue-500 dark:bg-blue-400"
            />
            <ScopeBar
              label="Admin"
              count={adminCount}
              max={maxScope}
              colorClass="bg-red-500 dark:bg-red-400"
            />
          </CardContent>
        </Card>
      </div>

      <ChatAuditFilterBar />

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No chat turns match the current filters.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Question preview</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Chunks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const user = userById.get(row.userId);
                const eng = row.engagementId
                  ? engById.get(row.engagementId)
                  : null;
                const engLabel = eng
                  ? truncate(
                      eng.projectName
                        ? `${eng.clientName} / ${eng.projectName}`
                        : eng.clientName,
                      40
                    )
                  : "—";
                const chunkCount = row.chunkIds.length;
                return (
                  <TableRow
                    key={row.id}
                    title={row.answerPreview || undefined}
                    className="hover:bg-muted/40"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatTimestamp(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {user?.email ?? (
                        <span className="font-mono text-muted-foreground">
                          {row.userId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.scope === "ADMIN" ? "destructive" : "secondary"
                        }
                      >
                        {row.scope}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {eng ? (
                        <Link
                          href={`/engagements/${eng.id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {engLabel}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[420px] text-xs">
                      {truncate(row.question, 80)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {row.tokensIn} / {row.tokensOut}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs tabular-nums ${
                        chunkCount === 0
                          ? "font-semibold text-red-600 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {chunkCount}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {rows.length} row{rows.length === 1 ? "" : "s"}
          {cursorParam ? " (paged)" : ""} — page size {PAGE_SIZE}.
        </p>
        <div className="flex gap-2">
          {cursorParam && (
            <Link
              href={buildPageLink(null)}
              className="inline-flex h-8 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
            >
              First page
            </Link>
          )}
          {nextCursor && (
            <Link
              href={buildPageLink(nextCursor)}
              className="inline-flex h-8 items-center justify-center rounded-md border bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ScopeBar({
  label,
  count,
  max,
  colorClass,
}: {
  label: string;
  count: number;
  max: number;
  colorClass: string;
}) {
  const pct = Math.round((count / max) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono tabular-nums">{count}</span>
    </div>
  );
}
