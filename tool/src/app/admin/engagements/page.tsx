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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface PhaseInfo {
  phaseNumber: string;
  status: string;
}

interface AdminEngagement {
  id: string;
  clientName: string;
  projectName: string | null;
  techStack: string;
  engagementType: string;
  status: string;
  workflowPath: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string };
  phases: PhaseInfo[];
}

const STATUS_OPTIONS = ["ALL", "DRAFT", "IN_PROGRESS", "COMPLETED", "ARCHIVED"];
const TECH_OPTIONS = ["ALL", "DRUPAL", "DRUPAL_NEXTJS", "WORDPRESS", "WORDPRESS_NEXTJS", "NEXTJS", "REACT"];

function statusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default" as const;
    case "IN_PROGRESS":
      return "secondary" as const;
    case "ARCHIVED":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function phaseProgress(phases: PhaseInfo[]) {
  const done = phases.filter((p) =>
    ["APPROVED", "REVIEW", "SKIPPED"].includes(p.status)
  ).length;
  return `${done}/${phases.length}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminEngagementsPage() {
  const [engagements, setEngagements] = React.useState<AdminEngagement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterStatus, setFilterStatus] = React.useState("ALL");
  const [filterTech, setFilterTech] = React.useState("ALL");
  const [filterCreator, setFilterCreator] = React.useState("ALL");

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (filterTech !== "ALL") params.set("techStack", filterTech);
    if (filterCreator !== "ALL") params.set("creator", filterCreator);

    fetch(`/api/admin/engagements?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setEngagements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, filterTech, filterCreator]);

  // Unique creators from loaded data for the filter
  const creators = React.useMemo(() => {
    const map = new Map<string, string>();
    engagements.forEach((e) => map.set(e.createdBy.id, e.createdBy.name));
    return Array.from(map.entries());
  }, [engagements]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">All Engagements</h1>
        <p className="text-sm text-muted-foreground">
          {engagements.length} engagement{engagements.length !== 1 ? "s" : ""} across all users
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={(v) => { if (v) setFilterStatus(v) }}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "All Statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTech} onValueChange={(v) => { if (v) setFilterTech(v) }}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue placeholder="Tech Stack" />
          </SelectTrigger>
          <SelectContent>
            {TECH_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "ALL" ? "All Tech Stacks" : t.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {creators.length > 0 && (
          <Select value={filterCreator} onValueChange={(v) => { if (v) setFilterCreator(v) }}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Creator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Creators</SelectItem>
              {creators.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading engagements...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Tech Stack</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead className="text-center">Phases</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {engagements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No engagements found
                  </TableCell>
                </TableRow>
              ) : (
                engagements.map((eng) => (
                  <TableRow key={eng.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {eng.clientName}
                        </div>
                        {eng.projectName && (
                          <div className="truncate text-xs text-muted-foreground">
                            {eng.projectName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {eng.createdBy.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {eng.techStack.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {eng.workflowPath
                        ? eng.workflowPath.replace("_", " ")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {phaseProgress(eng.phases)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(eng.status)} className="text-xs">
                        {eng.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(eng.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(eng.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/engagements/${eng.id}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
