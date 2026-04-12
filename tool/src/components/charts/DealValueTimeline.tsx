"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface DealValueTimelineProps {
  data: { quarter: string; pipelineValue: number; wonValue: number }[];
}

function formatCurrencyK(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

interface TimelineTooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface TimelineTooltipProps {
  active?: boolean;
  payload?: TimelineTooltipPayload[];
  label?: string;
}

function TimelineTooltip({ active, payload, label }: TimelineTooltipProps) {
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
          <span className="font-medium">{formatCurrencyK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DealValueTimeline({ data }: DealValueTimelineProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No deal value data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.5}
          />
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrencyK}
          />
          <Tooltip content={<TimelineTooltip />} />
          <Line
            type="monotone"
            dataKey="pipelineValue"
            name="Pipeline"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="wonValue"
            name="Won"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 inline-block rounded bg-blue-500" />
          Pipeline
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 inline-block rounded bg-green-500" />
          Won
        </span>
      </div>
    </div>
  );
}
