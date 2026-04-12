"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface LossReasonsChartProps {
  data: Record<string, number>;
}

const LOSS_REASON_LABELS: Record<string, string> = {
  PRICE_TOO_HIGH: "Price Too High",
  SCOPE_MISMATCH: "Scope Mismatch",
  COMPETITOR_PREFERRED: "Competitor Preferred",
  TIMELINE_MISMATCH: "Timeline Mismatch",
  BUDGET_CUT: "Budget Cut",
  RELATIONSHIP: "Relationship",
  TECHNICAL_FIT: "Technical Fit",
  NO_DECISION_MADE: "No Decision Made",
  OTHER: "Other",
};

export function LossReasonsChart({ data }: LossReasonsChartProps) {
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([reason, count]) => ({
      reason: LOSS_REASON_LABELS[reason] ?? reason,
      count,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No loss reason data recorded yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 40)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          opacity={0.5}
          horizontal={false}
        />
        <XAxis
          type="number"
          dataKey="count"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="reason"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip
          formatter={(value) => [Number(value), "Count"]}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((_, index) => (
            <Cell key={index} fill="#ef4444" fillOpacity={0.8 - index * 0.05} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
