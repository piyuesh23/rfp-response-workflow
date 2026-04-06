"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Zap, Coins, DollarSign } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface ModelStat {
  modelId: string;
  totalTokens: number;
  estimatedCost: number;
  count: number;
}

interface EngagementStat {
  engagementId: string;
  clientName: string;
  projectName: string | null;
  techStack: string | null;
  phasesRun: number;
  totalTokens: number;
  estimatedCost: number;
}

interface AnalyticsData {
  totals: AnalyticsTotals;
  byUser: UserStat[];
  byPhase: PhaseStat[];
  daily: DailyStat[];
  byModel: ModelStat[];
  byEngagement: EngagementStat[];
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function modelLabel(modelId: string): string {
  if (modelId.includes("opus")) return "Opus";
  if (modelId.includes("sonnet")) return "Sonnet";
  if (modelId.includes("haiku")) return "Haiku";
  return modelId;
}

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  opus: "#6366f1",
  sonnet: "#22c55e",
  haiku: "#f59e0b",
  cost: "#f59e0b",
  phases: "#3b82f6",
};

const MODEL_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

function successRateColor(rate: number): string {
  if (rate >= 80) return "#22c55e";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
}

function SummaryCard({ label, value, icon, subtext }: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {subtext && (
        <p className="text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bar count label
// ---------------------------------------------------------------------------

interface BarCountLabelProps {
  x?: string | number;
  y?: string | number;
  width?: string | number;
  height?: string | number;
  index?: number;
  chartData?: Array<{ count: number }>;
}

function BarCountLabel({ x = 0, y = 0, width = 0, height = 0, index = 0, chartData = [] }: BarCountLabelProps) {
  const entry = chartData[index];
  if (!entry) return null;
  return (
    <text
      x={Number(x) + Number(width) + 6}
      y={Number(y) + Number(height) / 2}
      dy={4}
      fontSize={10}
      fill="hsl(var(--muted-foreground))"
    >
      {entry.count}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar initials
// ---------------------------------------------------------------------------

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for daily chart
// ---------------------------------------------------------------------------

interface DailyTooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface DailyTooltipProps {
  active?: boolean;
  payload?: DailyTooltipPayload[];
  label?: string;
}

function DailyTooltip({ active, payload, label }: DailyTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-3 text-sm shadow-md space-y-1">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {p.name === "Cost" ? formatCost(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for phase chart
// ---------------------------------------------------------------------------

interface PhaseTooltipPayload {
  payload?: PhaseStat & { fill?: string };
}

interface PhaseTooltipProps {
  active?: boolean;
  payload?: PhaseTooltipPayload[];
}

function PhaseTooltip({ active, payload }: PhaseTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border bg-popover p-3 text-sm shadow-md space-y-1">
      <p className="font-medium">Phase {d.phaseNumber}</p>
      <div className="text-muted-foreground">
        Runs: <span className="text-foreground font-medium">{d.count}</span>
      </div>
      <div className="text-muted-foreground">
        Avg Cost:{" "}
        <span className="text-foreground font-medium">
          {formatCost(d.avgCost)}
        </span>
      </div>
      <div className="text-muted-foreground">
        Success Rate:{" "}
        <span className="text-foreground font-medium">{d.successRate}%</span>
      </div>
      <div className="text-muted-foreground">
        Avg Duration:{" "}
        <span className="text-foreground font-medium">
          {formatDuration(d.avgDurationMs)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut center label
// ---------------------------------------------------------------------------

interface DonutLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}

function DonutLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
  name = "",
}: DonutLabelProps) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

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
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        )
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

  const { totals, byUser, byPhase, daily, byModel, byEngagement } = data;

  // Prepare daily chart data — last 30 days, formatted dates
  const dailyChartData = daily.map((d) => ({
    date: formatDate(d.date),
    rawDate: d.date,
    Phases: d.phasesRun,
    Cost: d.estimatedCost,
    Tokens: d.totalTokens,
  }));

  // Phase chart data sorted by phase number
  const phaseChartData = [...byPhase]
    .sort((a, b) => a.phaseNumber.localeCompare(b.phaseNumber))
    .map((p) => ({
      ...p,
      fill: successRateColor(p.successRate),
    }));

  // Model donut data
  const modelDonutData = byModel.map((m, i) => ({
    name: modelLabel(m.modelId),
    value: m.totalTokens,
    color:
      m.modelId.includes("opus")
        ? CHART_COLORS.opus
        : m.modelId.includes("sonnet")
        ? CHART_COLORS.sonnet
        : MODEL_PALETTE[i % MODEL_PALETTE.length],
  }));

  // Sort user leaderboard by cost descending
  const sortedUsers = [...byUser].sort(
    (a, b) => b.estimatedCost - a.estimatedCost
  );

  return (
    <div className="space-y-8">
      {/* Header */}
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
          icon={<Building2 className="h-4 w-4" />}
        />
        <SummaryCard
          label="Phases Run"
          value={totals.phasesRun}
          icon={<Zap className="h-4 w-4" />}
        />
        <SummaryCard
          label="Tokens Used"
          value={formatTokens(totals.tokensConsumed)}
          icon={<Coins className="h-4 w-4" />}
          subtext={`${totals.tokensConsumed.toLocaleString()} total`}
        />
        <SummaryCard
          label="Estimated Cost"
          value={`$${totals.estimatedCostUsd.toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Row 2: Daily Activity + Token Donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Daily Activity Line Chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-base font-medium">Daily Activity (Last 30 Days)</h2>
          {dailyChartData.length === 0 ? (
            <EmptyState message="No activity in the last 30 days" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={dailyChartData}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={CHART_COLORS.cost}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={CHART_COLORS.cost}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(
                    0,
                    Math.floor(dailyChartData.length / 6) - 1
                  )}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip content={<DailyTooltip />} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Phases"
                  stroke={CHART_COLORS.phases}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="Cost"
                  stroke={CHART_COLORS.cost}
                  strokeWidth={2}
                  fill="url(#costGradient)"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span
                className="w-3 h-0.5 inline-block rounded"
                style={{ backgroundColor: CHART_COLORS.phases }}
              />
              Phases Run
            </span>
            <span className="flex items-center gap-1">
              <span
                className="w-3 h-0.5 inline-block rounded"
                style={{ backgroundColor: CHART_COLORS.cost }}
              />
              Cost
            </span>
          </div>
        </div>

        {/* Token Split Donut */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-base font-medium">Token Split by Model</h2>
          {modelDonutData.length === 0 ? (
            <EmptyState message="No model data yet" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={modelDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    labelLine={false}
                    label={DonutLabel}
                  >
                    {modelDonutData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      formatTokens(Number(value)),
                      "Tokens",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {modelDonutData.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </span>
                    <span className="font-medium">
                      {formatTokens(entry.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Phase Bar Chart + User Leaderboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Phase Breakdown Bar Chart */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-base font-medium">Phase Breakdown</h2>
          {phaseChartData.length === 0 ? (
            <EmptyState message="No phase data yet" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={phaseChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    dataKey="avgCost"
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="phaseNumber"
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => `Ph ${v}`}
                    width={42}
                  />
                  <Tooltip content={<PhaseTooltip />} />
                  <Bar
                    dataKey="avgCost"
                    radius={[0, 4, 4, 0]}
                    label={<BarCountLabel chartData={phaseChartData} />}
                  >
                    {phaseChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  ≥80% success
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  50–79%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  &lt;50%
                </span>
              </div>
            </>
          )}
        </div>

        {/* User Leaderboard */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="text-base font-medium">User Leaderboard</h2>
          {sortedUsers.length === 0 ? (
            <EmptyState message="No user data yet" />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-right text-xs">Engs</TableHead>
                    <TableHead className="text-right text-xs">Phases</TableHead>
                    <TableHead className="text-right text-xs">Tokens</TableHead>
                    <TableHead className="text-right text-xs">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((row, i) => (
                    <TableRow
                      key={row.userId}
                      className={
                        i % 2 === 0
                          ? "bg-background hover:bg-muted/30"
                          : "bg-muted/10 hover:bg-muted/30"
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={row.userName} />
                          <div>
                            <div className="text-sm font-medium leading-tight">
                              {row.userName}
                            </div>
                            <div className="text-xs text-muted-foreground leading-tight">
                              {row.userEmail}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.engagements}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {row.phasesRun}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatTokens(row.totalTokens)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCost(row.estimatedCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Top Engagements by Cost */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-base font-medium">Top Engagements by Cost</h2>
        {byEngagement.length === 0 ? (
          <EmptyState message="No engagement data yet" />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Client</TableHead>
                  <TableHead className="text-xs">Project</TableHead>
                  <TableHead className="text-xs">Stack</TableHead>
                  <TableHead className="text-right text-xs">Phases</TableHead>
                  <TableHead className="text-right text-xs">Tokens</TableHead>
                  <TableHead className="text-right text-xs">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEngagement.map((row, i) => (
                  <TableRow
                    key={row.engagementId}
                    className={
                      i % 2 === 0
                        ? "bg-background hover:bg-muted/30"
                        : "bg-muted/10 hover:bg-muted/30"
                    }
                  >
                    <TableCell className="text-sm font-medium">
                      <a
                        href={`/engagements/${row.engagementId}`}
                        className="hover:underline text-primary"
                      >
                        {row.clientName}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.projectName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.techStack ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.phasesRun}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatTokens(row.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCost(row.estimatedCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
