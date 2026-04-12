"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2 } from "lucide-react";

interface ImportJob {
  id: string;
  sourcePath: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  confirmedFiles: number;
  skippedFiles: number;
  createdAt: string;
  batchId: string | null;
  _count: { items: number };
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  PROCESSING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PAUSED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  REVIEW: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminImportsPage() {
  const router = useRouter();
  const [jobs, setJobs] = React.useState<ImportJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Auto-confirm threshold state
  const [autoConfirmEnabled, setAutoConfirmEnabled] = React.useState(false);
  const [autoConfirmThreshold, setAutoConfirmThreshold] = React.useState("0.8");

  React.useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/imports");
      if (res.ok) {
        setJobs(await res.json() as ImportJob[]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteJob(jobId: string, confirmedCount: number) {
    const msg = confirmedCount > 0
      ? `Delete this import and its ${confirmedCount} imported engagement(s)? This cannot be undone.`
      : "Delete this import? This cannot be undone.";
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/imports/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Failed to delete import");
      }
    } catch {
      setError("Failed to delete import — check network connection");
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("file", file);
      }
      if (autoConfirmEnabled) {
        const threshold = parseFloat(autoConfirmThreshold);
        if (!isNaN(threshold) && threshold > 0 && threshold <= 1) {
          formData.append("autoConfirmThreshold", String(threshold));
        }
      }

      const res = await fetch("/api/imports/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string; existingJobId?: string };
        setError(body.error ?? "Upload failed");
        if (body.existingJobId) {
          router.push(`/admin/imports/${body.existingJobId}`);
        }
        return;
      }

      const result = await res.json() as ImportJob | ImportJob[];

      // Single file: navigate straight to job detail
      if (!Array.isArray(result)) {
        router.push(`/admin/imports/${result.id}`);
        return;
      }

      // Multiple files: refresh the list and stay on this page
      await fetchJobs();
    } catch {
      setError("Upload failed — check network connection");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Group jobs by batchId to show batch indicators
  const batchGroups = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      if (job.batchId) {
        map.set(job.batchId, (map.get(job.batchId) ?? 0) + 1);
      }
    }
    return map;
  }, [jobs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">RFP Imports</h1>
          <p className="text-sm text-muted-foreground">
            Import historical RFPs from ZIP files
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-confirm threshold option */}
          <div className="flex items-center gap-2 text-sm">
            <input
              id="auto-confirm-toggle"
              type="checkbox"
              className="rounded"
              checked={autoConfirmEnabled}
              onChange={(e) => setAutoConfirmEnabled(e.target.checked)}
            />
            <label htmlFor="auto-confirm-toggle" className="text-muted-foreground cursor-pointer select-none">
              Auto-confirm above
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={autoConfirmThreshold}
              disabled={!autoConfirmEnabled}
              onChange={(e) => setAutoConfirmThreshold(e.target.value)}
              className="w-16 h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
            />
            <span className="text-muted-foreground text-xs">confidence</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5 mr-1.5" />
            {uploading ? "Uploading..." : "Upload ZIP(s)"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading imports...</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <Upload className="mx-auto size-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No imports yet. Upload one or more ZIP files containing RFP folders to get started.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Each subfolder in the ZIP is treated as one engagement. PDF and DOCX files are supported.
            Select multiple ZIPs to upload them as a batch.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead className="text-center">Confirmed</TableHead>
                <TableHead className="text-center">Skipped</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/admin/imports/${job.id}`)}
                >
                  <TableCell className="font-medium text-sm">
                    {job.sourcePath}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[job.status] ?? ""}`}
                    >
                      {job.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {job.processedFiles}/{job.totalFiles}
                  </TableCell>
                  <TableCell className="text-center text-sm text-green-600 dark:text-green-400">
                    {job.confirmedFiles}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {job.skippedFiles}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {job.batchId ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        batch · {batchGroups.get(job.batchId) ?? 1} files
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(job.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job.id, job.confirmedFiles);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
