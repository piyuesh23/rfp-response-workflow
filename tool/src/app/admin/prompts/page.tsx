"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

interface PhasePromptRow {
  phaseNumber: string;
  label: string;
  source: "code" | "override";
  lastModified: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PromptsPage() {
  const [phases, setPhases] = React.useState<PhasePromptRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/admin/prompts")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setPhases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Prompt Management</h1>
        <p className="text-sm text-muted-foreground">Loading prompts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Prompt Management</h1>
        <p className="text-sm text-muted-foreground">
          View and override phase prompts used by the AI agent.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phase</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last Modified</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {phases.map((phase) => (
              <TableRow key={phase.phaseNumber}>
                <TableCell className="font-mono text-sm">
                  {phase.phaseNumber}
                </TableCell>
                <TableCell className="font-medium">{phase.label}</TableCell>
                <TableCell>
                  {phase.source === "override" ? (
                    <Badge variant="default">Custom Override</Badge>
                  ) : (
                    <Badge variant="secondary">Code Default</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(phase.lastModified)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/prompts/${phase.phaseNumber}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
