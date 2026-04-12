"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface OutcomePieChartProps {
  data: Record<string, number>;
}

const OUTCOME_COLORS: Record<string, string> = {
  WON: "#22c55e",
  PARTIAL_WIN: "#86efac",
  LOST: "#ef4444",
  NO_DECISION: "#94a3b8",
  WITHDRAWN: "#f97316",
  DEFERRED: "#a78bfa",
  NOT_SUBMITTED: "#cbd5e1",
};

const OUTCOME_LABELS: Record<string, string> = {
  WON: "Won",
  PARTIAL_WIN: "Partial Win",
  LOST: "Lost",
  NO_DECISION: "No Decision",
  WITHDRAWN: "Withdrawn",
  DEFERRED: "Deferred",
  NOT_SUBMITTED: "Not Submitted",
};

interface DonutLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}

function DonutLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
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

export function OutcomePieChart({ data }: OutcomePieChartProps) {
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([outcome, count]) => ({
      name: OUTCOME_LABELS[outcome] ?? outcome,
      value: count,
      color: OUTCOME_COLORS[outcome] ?? "#94a3b8",
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No outcome data recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            dataKey="value"
            labelLine={false}
            label={DonutLabel}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [Number(value), String(name)]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5">
        {chartData.map((entry, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </span>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
