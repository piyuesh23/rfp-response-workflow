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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Building2,
  Zap,
  Coins,
  DollarSign,
  TrendingUp,
  Trophy,
  Target,
  BarChart2,
} from "lucide-react";

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

// ---------------------------------------------------------------------------
// Business types
// ---------------------------------------------------------------------------

interface IndustryStat {
  industry: string;
  total: number;
  won: number;
  lost: number;
  winRate: number;
  totalDealValue: number;
}

interface TechStackStat {
  techStack: string;
  total: number;
  won: number;
  lost: number;
  winRate: number;
  avgDealValue: number;
}

interface EngagementTypeStat {
  type: string;
  total: number;
  won: number;
  lost: number;
  winRate: number;
}

interface TopAccountStat {
  accountId: string;
  accountName: string;
  industry: string;
  engagements: number;
  winRate: number;
  pipelineValue: number;
  wonRevenue: number;
}

interface MonthlyVolumeStat {
  month: string;
  count: number;
  imported: number;
  native: number;
}

interface CompetitorStat {
  name: string;
  count: number;
  winAgainst: number;
  lossAgainst: number;
}

interface BusinessSummary {
  totalAccounts: number;
  totalEngagements: number;
  engagementsWithOutcome: number;
  overallWinRate: number;
  totalPipeline: number;
  totalWonRevenue: number;
  avgDealSize: number;
  importedEngagements: number;
}

interface BusinessData {
  byIndustry: IndustryStat[];
  byTechStack: TechStackStat[];
  byEngagementType: EngagementTypeStat[];
  topAccounts: TopAccountStat[];
  monthlyVolume: MonthlyVolumeStat[];
  lossReasons: Record<string, number>;
  topCompetitors: CompetitorStat[];
  summary: BusinessSummary;
}

interface EffortByTechStack {
  techStack: string;
  avgTotalHours: number;
  avgBackend: number;
  avgFrontend: number;
  avgFixedCost: number;
  avgAi: number;
  sampleSize: number;
}

interface EffortByIndustry {
  industry: string;
  avgTotalHours: number;
  avgBackend: number;
  avgFrontend: number;
  sampleSize: number;
}

interface EffortByEngType {
  type: string;
  avgTotalHours: number;
  sampleSize: number;
}

interface EffortBenchmarks {
  byTechStack: EffortByTechStack[];
  byIndustry: EffortByIndustry[];
  byEngagementType: EffortByEngType[];
}

interface AnalyticsData {
  totals: AnalyticsTotals;
  byUser: UserStat[];
  byPhase: PhaseStat[];
  daily: DailyStat[];
  byModel: ModelStat[];
  byEngagement: EngagementStat[];
  business?: BusinessData;
  effortBenchmarks?: EffortBenchmarks;
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

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function winRateColor(rate: number): string {
  if (rate >= 60) return "#22c55e";
  if (rate >= 40) return "#f59e0b";
  return "#ef4444";
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
const LOSS_REASON_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#06b6d4",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#a16207",
];

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

  const { totals, byUser, byPhase, daily, byModel, byEngagement, business } = data;

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

  // Business tab derived data
  const lossReasonPieData = business
    ? Object.entries(business.lossReasons).map(([name, value], i) => ({
        name: name.replace(/_/g, " "),
        value,
        color: LOSS_REASON_PALETTE[i % LOSS_REASON_PALETTE.length],
      }))
    : [];

  const monthlyChartData = business
    ? business.monthlyVolume.map((m) => ({
        month: formatMonth(m.month),
        Native: m.native,
        Imported: m.imported,
      }))
    : [];

  const industryChartData = business
    ? business.byIndustry
        .filter((r) => r.total > 0)
        .map((r) => ({ name: r.industry.replace(/_/g, " "), winRate: r.winRate, total: r.total }))
    : [];

  const techStackChartData = business
    ? business.byTechStack
        .filter((r) => r.total > 0)
        .map((r) => ({ name: r.techStack.replace(/_/g, " "), winRate: r.winRate, total: r.total }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Analytics &amp; Metrics</h1>
        <p className="text-sm text-muted-foreground">
          Usage, cost, and business intelligence across all engagements
        </p>
      </div>

      <Tabs defaultValue="operations">
        <TabsList>
          <TabsTrigger value="operations">
            <Zap className="h-3.5 w-3.5" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="business">
            <BarChart2 className="h-3.5 w-3.5" />
            Business
          </TabsTrigger>
          <TabsTrigger value="benchmarks">
            <Target className="h-3.5 w-3.5" />
            Effort Benchmarks
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* OPERATIONS TAB                                                      */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="operations">
          <div className="space-y-8 pt-4">
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
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* BUSINESS TAB                                                        */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="business">
          {!business ? (
            <EmptyState message="Business data not available" />
          ) : (
            <div className="space-y-8 pt-4">
              {/* Business Summary cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryCard
                  label="Total Pipeline"
                  value={formatMoney(business.summary.totalPipeline)}
                  icon={<TrendingUp className="h-4 w-4" />}
                  subtext={`${business.summary.totalEngagements} engagements`}
                />
                <SummaryCard
                  label="Won Revenue"
                  value={formatMoney(business.summary.totalWonRevenue)}
                  icon={<Trophy className="h-4 w-4" />}
                  subtext={`${business.summary.engagementsWithOutcome} with outcome`}
                />
                <SummaryCard
                  label="Overall Win Rate"
                  value={`${business.summary.overallWinRate}%`}
                  icon={<Target className="h-4 w-4" />}
                  subtext={`${business.summary.totalAccounts} accounts`}
                />
                <SummaryCard
                  label="Avg Deal Size"
                  value={formatMoney(business.summary.avgDealSize)}
                  icon={<DollarSign className="h-4 w-4" />}
                  subtext={`${business.summary.importedEngagements} imported`}
                />
              </div>

              {/* Win Rate by Industry + Win Rate by Tech Stack */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* By Industry */}
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <h2 className="text-base font-medium">Win Rate by Industry</h2>
                  {industryChartData.length === 0 ? (
                    <EmptyState message="No industry data yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(200, industryChartData.length * 36)}>
                      <BarChart
                        data={industryChartData}
                        layout="vertical"
                        margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          opacity={0.5}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={120}
                        />
                        <Tooltip
                          formatter={(value, name) => [`${value}%`, name === "winRate" ? "Win Rate" : String(name)]}
                        />
                        <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                          {industryChartData.map((entry, index) => (
                            <Cell key={index} fill={winRateColor(entry.winRate)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* By Tech Stack */}
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <h2 className="text-base font-medium">Win Rate by Tech Stack</h2>
                  {techStackChartData.length === 0 ? (
                    <EmptyState message="No tech stack data yet" />
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(200, techStackChartData.length * 48)}>
                      <BarChart
                        data={techStackChartData}
                        layout="vertical"
                        margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          opacity={0.5}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={false}
                          axisLine={false}
                          width={120}
                        />
                        <Tooltip
                          formatter={(value, name) => [`${value}%`, name === "winRate" ? "Win Rate" : String(name)]}
                        />
                        <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                          {techStackChartData.map((entry, index) => (
                            <Cell key={index} fill={winRateColor(entry.winRate)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Top Accounts */}
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <h2 className="text-base font-medium">Top Accounts by Pipeline</h2>
                {business.topAccounts.length === 0 ? (
                  <EmptyState message="No account data yet" />
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs">Account</TableHead>
                          <TableHead className="text-xs">Industry</TableHead>
                          <TableHead className="text-right text-xs">Engs</TableHead>
                          <TableHead className="text-right text-xs">Win Rate</TableHead>
                          <TableHead className="text-right text-xs">Pipeline</TableHead>
                          <TableHead className="text-right text-xs">Won Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {business.topAccounts.map((row, i) => (
                          <TableRow
                            key={row.accountId}
                            className={
                              i % 2 === 0
                                ? "bg-background hover:bg-muted/30"
                                : "bg-muted/10 hover:bg-muted/30"
                            }
                          >
                            <TableCell className="text-sm font-medium">
                              {row.accountName}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {row.industry.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {row.engagements}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <span
                                className="font-medium"
                                style={{ color: winRateColor(row.winRate) }}
                              >
                                {row.winRate}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatMoney(row.pipelineValue)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-green-600 font-medium">
                              {formatMoney(row.wonRevenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Monthly Volume + Loss Reasons */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Monthly Volume Area Chart */}
                <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-3">
                  <h2 className="text-base font-medium">Monthly Engagement Volume (Last 12 Months)</h2>
                  {monthlyChartData.length === 0 ? (
                    <EmptyState message="No monthly data yet" />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart
                          data={monthlyChartData}
                          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="nativeGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="importedGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            opacity={0.5}
                          />
                          <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="Native"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#nativeGradient)"
                            dot={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="Imported"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fill="url(#importedGradient)"
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-0.5 inline-block rounded bg-blue-500" />
                          Native
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-0.5 inline-block rounded bg-violet-500" />
                          Imported
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Loss Reasons Pie */}
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <h2 className="text-base font-medium">Loss Reasons</h2>
                  {lossReasonPieData.length === 0 ? (
                    <EmptyState message="No loss data yet" />
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={lossReasonPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            labelLine={false}
                            label={DonutLabel}
                          >
                            {lossReasonPieData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, "Losses"]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1">
                        {lossReasonPieData.map((entry, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="text-muted-foreground truncate max-w-[140px]">
                                {entry.name}
                              </span>
                            </span>
                            <span className="font-medium">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Top Competitors */}
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <h2 className="text-base font-medium">Top Competitors</h2>
                {business.topCompetitors.length === 0 ? (
                  <EmptyState message="No competitor data recorded yet" />
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs">Competitor</TableHead>
                          <TableHead className="text-right text-xs">Times Faced</TableHead>
                          <TableHead className="text-right text-xs">Won Against</TableHead>
                          <TableHead className="text-right text-xs">Lost Against</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {business.topCompetitors.map((row, i) => (
                          <TableRow
                            key={row.name}
                            className={
                              i % 2 === 0
                                ? "bg-background hover:bg-muted/30"
                                : "bg-muted/10 hover:bg-muted/30"
                            }
                          >
                            <TableCell className="text-sm font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {row.count}
                            </TableCell>
                            <TableCell className="text-right text-sm text-green-600 font-medium">
                              {row.winAgainst}
                            </TableCell>
                            <TableCell className="text-right text-sm text-red-500 font-medium">
                              {row.lossAgainst}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* EFFORT BENCHMARKS TAB                                              */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="benchmarks">
          {data.effortBenchmarks && (
            <div className="space-y-8 pt-4">
              {/* By Tech Stack — bar chart */}
              {data.effortBenchmarks.byTechStack.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Average Hours by Tech Stack</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.effortBenchmarks.byTechStack}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="techStack" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="avgBackend" name="Backend" fill="#3b82f6" stackId="hours" />
                        <Bar dataKey="avgFrontend" name="Frontend" fill="#8b5cf6" stackId="hours" />
                        <Bar dataKey="avgFixedCost" name="Fixed Cost" fill="#f59e0b" stackId="hours" />
                        <Bar dataKey="avgAi" name="AI" fill="#10b981" stackId="hours" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tech Stack</TableHead>
                        <TableHead className="text-xs text-right">Avg Total</TableHead>
                        <TableHead className="text-xs text-right">Backend</TableHead>
                        <TableHead className="text-xs text-right">Frontend</TableHead>
                        <TableHead className="text-xs text-right">Fixed Cost</TableHead>
                        <TableHead className="text-xs text-right">AI</TableHead>
                        <TableHead className="text-xs text-right">Samples</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.effortBenchmarks.byTechStack.map((row) => (
                        <TableRow key={row.techStack}>
                          <TableCell className="text-xs font-medium">{row.techStack.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{row.avgTotalHours}h</TableCell>
                          <TableCell className="text-xs text-right">{row.avgBackend}h</TableCell>
                          <TableCell className="text-xs text-right">{row.avgFrontend}h</TableCell>
                          <TableCell className="text-xs text-right">{row.avgFixedCost}h</TableCell>
                          <TableCell className="text-xs text-right">{row.avgAi}h</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">{row.sampleSize}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* By Industry */}
              {data.effortBenchmarks.byIndustry.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Average Hours by Industry</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Industry</TableHead>
                        <TableHead className="text-xs text-right">Avg Total</TableHead>
                        <TableHead className="text-xs text-right">Backend</TableHead>
                        <TableHead className="text-xs text-right">Frontend</TableHead>
                        <TableHead className="text-xs text-right">Samples</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.effortBenchmarks.byIndustry.map((row) => (
                        <TableRow key={row.industry}>
                          <TableCell className="text-xs font-medium">{row.industry.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{row.avgTotalHours}h</TableCell>
                          <TableCell className="text-xs text-right">{row.avgBackend}h</TableCell>
                          <TableCell className="text-xs text-right">{row.avgFrontend}h</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">{row.sampleSize}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* By Engagement Type */}
              {data.effortBenchmarks.byEngagementType.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Average Hours by Engagement Type</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.effortBenchmarks.byEngagementType}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="type" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.replace(/_/g, " ")} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="avgTotalHours" name="Avg Hours" fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {data.effortBenchmarks.byTechStack.length === 0 &&
                data.effortBenchmarks.byIndustry.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No estimate data available yet. Import RFPs with estimate documents to see effort benchmarks.
                  </p>
                )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
