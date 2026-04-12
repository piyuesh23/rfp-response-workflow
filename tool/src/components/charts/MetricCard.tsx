import * as React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function MetricCard({ label, value, subtitle, className }: MetricCardProps) {
  return (
    <div className={`rounded-xl border bg-card p-5 flex flex-col gap-2 ${className ?? ""}`}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
