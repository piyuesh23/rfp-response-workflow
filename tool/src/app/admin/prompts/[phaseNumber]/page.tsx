"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PromptInfo {
  content: string;
  source: "code" | "override";
  version: number | null;
}

interface HistoryEntry {
  id: string;
  promptType: string;
  version: number;
  isActive: boolean;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

interface PhasePromptData {
  phaseNumber: string;
  label: string;
  source: "code" | "override";
  systemPrompt: PromptInfo;
  userPrompt: PromptInfo;
  history: HistoryEntry[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EditPromptPage() {
  const params = useParams<{ phaseNumber: string }>();
  const router = useRouter();
  const phaseNumber = params.phaseNumber;

  const [data, setData] = React.useState<PhasePromptData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [promptType, setPromptType] = React.useState<"SYSTEM" | "USER">("USER");
  const [content, setContent] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [reverting, setReverting] = React.useState(false);
  const [viewingId, setViewingId] = React.useState<string | null>(null);

  const fetchData = React.useCallback(() => {
    fetch(`/api/admin/prompts/${phaseNumber}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: PhasePromptData) => {
        setData(d);
        // Default content to current active prompt for selected type
        setContent(d.userPrompt.content);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phaseNumber]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update textarea when promptType changes
  React.useEffect(() => {
    if (!data) return;
    setContent(
      promptType === "SYSTEM"
        ? data.systemPrompt.content
        : data.userPrompt.content
    );
  }, [promptType, data]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prompts/${phaseNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptType, content, notes: notes || undefined }),
      });
      if (res.ok) {
        setNotes("");
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to save prompt");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRevert() {
    if (
      !confirm(
        "Revert to code default? All active overrides for this phase will be deactivated."
      )
    )
      return;
    setReverting(true);
    try {
      const res = await fetch(`/api/admin/prompts/${phaseNumber}/revert`, {
        method: "POST",
      });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to revert");
      }
    } finally {
      setReverting(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const viewingEntry = viewingId
    ? data.history.find((h) => h.id === viewingId)
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Edit Prompt: Phase {data.phaseNumber} — {data.label}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Current source:{" "}
            {data.source === "override" ? (
              <Badge variant="default">Custom Override</Badge>
            ) : (
              <Badge variant="secondary">Code Default</Badge>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/admin/prompts")}
        >
          Back
        </Button>
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <div className="space-y-2">
          <Label>Prompt Type</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="promptType"
                value="USER"
                checked={promptType === "USER"}
                onChange={() => setPromptType("USER")}
                className="accent-primary"
              />
              <span className="text-sm">User Prompt</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="promptType"
                value="SYSTEM"
                checked={promptType === "SYSTEM"}
                onChange={() => setPromptType("SYSTEM")}
                className="accent-primary"
              />
              <span className="text-sm">System Prompt</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-content">Prompt Content</Label>
          <Textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter prompt content..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional changelog entry)</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what changed and why..."
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? "Saving..." : "Save Override"}
          </Button>
          <Button
            variant="outline"
            onClick={handleRevert}
            disabled={reverting || data.source === "code"}
          >
            {reverting ? "Reverting..." : "Revert to Default"}
          </Button>
        </div>
      </div>

      {data.history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Version History</h2>
          <div className="rounded-md border divide-y">
            {data.history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>
                      {entry.promptType} v{entry.version}
                    </span>
                    {entry.isActive && (
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)} by {entry.createdBy}
                    {entry.notes && (
                      <span className="ml-2 italic">— {entry.notes}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setViewingId(viewingId === entry.id ? null : entry.id)
                  }
                >
                  {viewingId === entry.id ? "Hide" : "View"}
                </Button>
              </div>
            ))}
          </div>

          {viewingEntry && (
            <div className="rounded-md border p-4 bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {viewingEntry.promptType} v{viewingEntry.version} content:
              </p>
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {/* Content not included in history list — fetch full entry to show */}
                (Load full content from GET /api/admin/prompts/{phaseNumber} to
                display version content)
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
