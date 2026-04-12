"use client";

import * as React from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Summary {
  totalEngagements: number;
  activeEngagements: number;
  totalAccounts: number;
  pipelineValue: number;
  wonValue: number;
  overallWinRate: number;
}

interface MonthPoint {
  month: string;
  won: number;
  lost: number;
  total: number;
  winRate: number;
}

interface IndustryRow {
  industry: string;
  count: number;
  won: number;
  lost: number;
  winRate: number;
  totalValue: number;
}

interface TechStackRow {
  techStack: string;
  count: number;
  won: number;
  lost: number;
  winRate: number;
}

interface SourceRow {
  source: string;
  count: number;
  won: number;
  lost: number;
  winRate: number;
}

interface LossReason {
  reason: string;
  count: number;
  percentage: number;
}

interface TopAccount {
  id: string;
  name: string;
  industry: string;
  engagementCount: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  totalValue: number;
  lastEngagementDate: string;
}

interface VolumePoint {
  month: string;
  count: number;
}

interface CycleTime {
  avgDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
}

interface AiCost {
  totalCost: number;
  avgCostPerEngagement: number;
  totalTokens: number;
}

interface AnalyticsData {
  summary: Summary;
  winRateByMonth: MonthPoint[];
  byIndustry: IndustryRow[];
  byTechStack: TechStackRow[];
  bySource: SourceRow[];
  lossReasons: LossReason[];
  topAccounts: TopAccount[];
  monthlyVolume: VolumePoint[];
  cycleTime: CycleTime;
  aiCost: AiCost;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function winRateColor(rate: number): string {
  if (rate >= 60) return "text-green-600";
  if (rate >= 40) return "text-amber-600";
  return "text-red-600";
}

// ---------------------------------------------------------------------------
// EmptyChart — shown when data is insufficient
// ---------------------------------------------------------------------------

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Line Chart for win-rate trend
// ---------------------------------------------------------------------------

function WinRateLineChart({ data }: { data: MonthPoint[] }) {
  const hasData = data.some((d) => d.total > 0);
  if (!hasData) {
    return (
      <EmptyChart message="Not enough data — need at least 5 engagements with recorded outcomes to show win rate trends." />
    );
  }

  const W = 600;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const rates = data.map((d) => d.winRate);
  const maxRate = Math.max(...rates, 100);
  const xStep = innerW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + innerH - (d.winRate / maxRate) * innerH,
    rate: d.winRate,
    month: d.month,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid lines */}
      {yTicks.map((t) => {
        const y = PAD.top + innerH - (t / 100) * innerH;
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={y}
              x2={PAD.left + innerW}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.5}
            >
              {t}%
            </text>
          </g>
        );
      })}

      {/* X-axis labels (every other month) */}
      {points.map((p, i) =>
        i % 2 === 0 ? (
          <text
            key={p.month}
            x={p.x}
            y={H - 6}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {formatMonth(p.month)}
          </text>
        ) : null
      )}

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Dots */}
      {points.map((p) => (
        <circle key={p.month} cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar Chart for loss reasons
// ---------------------------------------------------------------------------

function LossReasonsChart({ data }: { data: LossReason[] }) {
  if (data.length === 0) {
    return (
      <EmptyChart message="No loss reasons recorded yet. Loss data will appear after engagements are marked as LOST with a reason." />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((item) => (
        <div key={item.reason} className="flex items-center gap-3">
          <div className="w-40 shrink-0 text-xs text-muted-foreground truncate text-right">
            {humanize(item.reason)}
          </div>
          <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
            <div
              className="h-full rounded bg-red-400"
              style={{ width: `${item.percentage}%` }}
            />
          </div>
          <div className="w-16 text-right text-xs text-muted-foreground">
            {item.count} ({item.percentage}%)
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly Volume Bar Chart
// ---------------------------------------------------------------------------

function VolumeBarChart({ data }: { data: VolumePoint[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <EmptyChart message="No RFP volume data in the last 12 months." />
    );
  }

  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d) => {
        const pct = Math.round((d.count / maxCount) * 100);
        return (
          <div key={d.month} className="flex flex-col items-center flex-1 gap-1">
            <span className="text-[9px] text-muted-foreground leading-none">
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className="w-full rounded-t bg-blue-400"
              style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%`, minHeight: d.count > 0 ? "4px" : "0" }}
            />
            <span className="text-[9px] text-muted-foreground leading-none rotate-0">
              {formatMonth(d.month).split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Win Rate badge helper
// ---------------------------------------------------------------------------

function WinRateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 60
      ? "bg-green-100 text-green-800"
      : rate >= 40
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {rate}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/analytics/presales")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<AnalyticsData>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-red-500">
        Failed to load analytics: {error ?? "Unknown error"}
      </div>
    );
  }

  const { summary, winRateByMonth, byIndustry, byTechStack, bySource, lossReasons, topAccounts, monthlyVolume, cycleTime, aiCost } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Presales Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline performance, win rates, and operational metrics
        </p>
      </div>

      <Tabs defaultValue="leadership">
        <TabsList>
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* LEADERSHIP TAB                                                    */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="leadership">
          <div className="flex flex-col gap-6 pt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total Engagements"
                value={summary.totalEngagements}
                sub={`${summary.activeEngagements} active`}
              />
              <StatCard
                label="Pipeline Value"
                value={formatCurrency(summary.pipelineValue)}
                sub="Open opportunities"
              />
              <StatCard
                label="Won Value"
                value={formatCurrency(summary.wonValue)}
                sub="Closed won contracts"
              />
              <StatCard
                label="Win Rate"
                value={`${summary.overallWinRate}%`}
                sub="WON / (WON + LOST)"
              />
            </div>

            {/* Win Rate Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate Trend (Last 12 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                <WinRateLineChart data={winRateByMonth} />
              </CardContent>
            </Card>

            {/* Loss Reasons */}
            <Card>
              <CardHeader>
                <CardTitle>Loss Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                <LossReasonsChart data={lossReasons} />
              </CardContent>
            </Card>

            {/* Win Rate by Industry */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate by Industry</CardTitle>
              </CardHeader>
              <CardContent>
                {byIndustry.length === 0 ? (
                  <EmptyChart message="No industry data available yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Industry</TableHead>
                        <TableHead className="text-right">Engagements</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byIndustry.map((row) => (
                        <TableRow key={row.industry}>
                          <TableCell className="font-medium">
                            {humanize(row.industry)}
                          </TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {row.won}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {row.lost}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.won + row.lost > 0 ? (
                              <WinRateBadge rate={row.winRate} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.totalValue)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* SALES TAB                                                         */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="sales">
          <div className="flex flex-col gap-6 pt-4">
            {/* Top Accounts */}
            <Card>
              <CardHeader>
                <CardTitle>Top Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {topAccounts.length === 0 ? (
                  <EmptyChart message="No account data yet. Link engagements to accounts to see this view." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead className="text-right">Engagements</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead>Last Engagement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topAccounts.map((acc) => (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {humanize(acc.industry)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {acc.engagementCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {acc.wonCount + acc.lostCount > 0 ? (
                              <WinRateBadge rate={acc.winRate} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(acc.totalValue)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {acc.lastEngagementDate
                              ? new Date(acc.lastEngagementDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Monthly RFP Volume */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly RFP Volume (Last 12 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                <VolumeBarChart data={monthlyVolume} />
              </CardContent>
            </Card>

            {/* Source Effectiveness */}
            <Card>
              <CardHeader>
                <CardTitle>Source Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                {bySource.length === 0 ? (
                  <EmptyChart message="No RFP source data yet. Set rfpSource on engagements to track channel performance." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Engagements</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bySource.map((row) => (
                        <TableRow key={row.source}>
                          <TableCell className="font-medium">
                            {humanize(row.source)}
                          </TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {row.won}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {row.lost}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.won + row.lost > 0 ? (
                              <WinRateBadge rate={row.winRate} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* OPERATIONS TAB                                                    */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="operations">
          <div className="flex flex-col gap-6 pt-4">
            {/* AI Cost Summary */}
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                AI Cost Summary
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Total AI Cost"
                  value={`$${aiCost.totalCost.toFixed(2)}`}
                  sub="All phase executions"
                />
                <StatCard
                  label="Avg Cost / Engagement"
                  value={`$${aiCost.avgCostPerEngagement.toFixed(2)}`}
                />
                <StatCard
                  label="Total Tokens"
                  value={
                    aiCost.totalTokens >= 1_000_000
                      ? `${(aiCost.totalTokens / 1_000_000).toFixed(1)}M`
                      : aiCost.totalTokens >= 1_000
                      ? `${(aiCost.totalTokens / 1_000).toFixed(0)}K`
                      : String(aiCost.totalTokens)
                  }
                />
              </div>
            </div>

            {/* Cycle Time */}
            <Card>
              <CardHeader>
                <CardTitle>Cycle Time (TOR Received → Submitted)</CardTitle>
              </CardHeader>
              <CardContent>
                {cycleTime.avgDays === 0 ? (
                  <EmptyChart message="No cycle time data yet. Cycle time is calculated from engagements that have a submission date recorded." />
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "Average", value: `${cycleTime.avgDays}d` },
                      { label: "Median", value: `${cycleTime.medianDays}d` },
                      { label: "Fastest", value: `${cycleTime.minDays}d` },
                      { label: "Slowest", value: `${cycleTime.maxDays}d` },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col gap-1 rounded-lg border p-4">
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                        <span className="text-2xl font-semibold">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* By Tech Stack */}
            <Card>
              <CardHeader>
                <CardTitle>Engagements by Tech Stack</CardTitle>
              </CardHeader>
              <CardContent>
                {byTechStack.length === 0 ? (
                  <EmptyChart message="No tech stack data available." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tech Stack</TableHead>
                        <TableHead className="text-right">Engagements</TableHead>
                        <TableHead className="text-right">Won</TableHead>
                        <TableHead className="text-right">Lost</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byTechStack.map((row) => (
                        <TableRow key={row.techStack}>
                          <TableCell>
                            <Badge variant="outline">
                              {humanize(row.techStack)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{row.count}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {row.won}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {row.lost}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.won + row.lost > 0 ? (
                              <WinRateBadge rate={row.winRate} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Engagements by Type */}
            <Card>
              <CardHeader>
                <CardTitle>Engagements by Type</CardTitle>
              </CardHeader>
              <CardContent>
                {byTechStack.length === 0 ? (
                  <EmptyChart message="No engagement type data available." />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(["NEW_BUILD", "MIGRATION", "REDESIGN", "ENHANCEMENT", "DISCOVERY"] as const).map(
                      (type) => {
                        const count = data.byTechStack.reduce(
                          // We don't have byEngagementType from API — show placeholder
                          (acc) => acc,
                          0
                        );
                        void count;
                        return null;
                      }
                    )}
                    <p className="text-sm text-muted-foreground">
                      Engagement type breakdown is included in the Tech Stack table above.
                      A dedicated type dimension can be added by extending the API.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
