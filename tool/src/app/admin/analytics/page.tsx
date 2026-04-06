"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnalyticsTotals {
  totalEngagements: number;
  phasesRun: number;
  tokensConsumed: number;
  estimatedCostUsd: number;
}

interface UserStat {
  userId: string;
  userName: string;
  userEmail: string;
  engagements: number;
  phasesRun: number;
  totalTokens: number;
  estimatedCost: number;
}

interface PhaseStat {
  phaseNumber: string;
  count: number;
  avgDurationMs: number;
  avgTokens: number;
  avgCost: number;
  successRate: number;
}

interface DailyStat {
  date: string;
  phasesRun: number;
  totalTokens: number;
  estimatedCost: number;
}

interface AnalyticsData {
  totals: AnalyticsTotals;
  byUser: UserStat[];
  byPhase: PhaseStat[];
  daily: DailyStat[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => {
        if (!res.ok) return Promise.reject(new Error(`HTTP ${res.status}`));
        return res.json() as Promise<AnalyticsData>;
      })
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load analytics")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Analytics &amp; Metrics</h1>
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Analytics &amp; Metrics</h1>
        <p className="text-sm text-destructive">{error ?? "No data available"}</p>
      </div>
    );
  }

  const { totals, byUser, byPhase, daily } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Analytics &amp; Metrics</h1>
        <p className="text-sm text-muted-foreground">
          Usage and cost metrics across all engagements
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Total Engagements"
          value={totals.totalEngagements}
        />
        <SummaryCard label="Phases Run" value={totals.phasesRun} />
        <SummaryCard
          label="Tokens Used"
          value={formatTokens(totals.tokensConsumed)}
        />
        <SummaryCard
          label="Estimated Cost"
          value={formatCost(totals.estimatedCostUsd)}
        />
      </div>

      {/* User leaderboard */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Usage by User</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Engagements</TableHead>
                <TableHead className="text-right">Phases</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byUser.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No data yet
                  </TableCell>
                </TableRow>
              ) : (
                byUser.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <div className="text-sm font-medium">{row.userName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.userEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.engagements}
                    </TableCell>
                    <TableCell className="text-right">{row.phasesRun}</TableCell>
                    <TableCell className="text-right">
                      {formatTokens(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(row.estimatedCost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Phase breakdown */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Phase Breakdown</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phase</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Avg Duration</TableHead>
                <TableHead className="text-right">Avg Tokens</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Success Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPhase.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No data yet
                  </TableCell>
                </TableRow>
              ) : (
                byPhase
                  .sort((a, b) => a.phaseNumber.localeCompare(b.phaseNumber))
                  .map((row) => (
                    <TableRow key={row.phaseNumber}>
                      <TableCell className="font-medium">
                        Phase {row.phaseNumber}
                      </TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">
                        {formatDuration(row.avgDurationMs)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTokens(row.avgTokens)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCost(row.avgCost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.successRate}%
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Daily activity */}
      <div className="space-y-2">
        <h2 className="text-base font-medium">Daily Activity (Last 30 Days)</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Phases Run</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground py-6"
                  >
                    No activity in the last 30 days
                  </TableCell>
                </TableRow>
              ) : (
                [...daily].reverse().map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="text-sm">{row.date}</TableCell>
                    <TableCell className="text-right">{row.phasesRun}</TableCell>
                    <TableCell className="text-right">
                      {formatTokens(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCost(row.estimatedCost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
