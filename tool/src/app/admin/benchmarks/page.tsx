"use client";

import * as React from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, X, Check, Ban } from "lucide-react";

type TechStack = "DRUPAL" | "DRUPAL_NEXTJS" | "NEXTJS" | "REACT";

interface Benchmark {
  id: string;
  techStack: TechStack;
  category: string;
  taskType: string;
  lowHours: number;
  highHours: number;
  tier: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

const TECH_STACKS: TechStack[] = ["DRUPAL", "DRUPAL_NEXTJS", "NEXTJS", "REACT"];
const TECH_STACK_LABELS: Record<TechStack, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
};
const TIER_OPTIONS = ["T1", "T2", "T3"];

interface EditState {
  lowHours: string;
  highHours: string;
  tier: string;
  notes: string;
}

interface AddState {
  techStack: TechStack;
  category: string;
  taskType: string;
  lowHours: string;
  highHours: string;
  tier: string;
  notes: string;
}

const EMPTY_ADD: AddState = {
  techStack: "DRUPAL",
  category: "",
  taskType: "",
  lowHours: "",
  highHours: "",
  tier: "",
  notes: "",
};

export default function AdminBenchmarksPage() {
  const [benchmarks, setBenchmarks] = React.useState<Benchmark[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterCategory, setFilterCategory] = React.useState<string>("");
  const [filterTechStack, setFilterTechStack] = React.useState<string>("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editState, setEditState] = React.useState<EditState>({
    lowHours: "",
    highHours: "",
    tier: "",
    notes: "",
  });
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [showAddRow, setShowAddRow] = React.useState(false);
  const [addState, setAddState] = React.useState<AddState>(EMPTY_ADD);
  const [adding, setAdding] = React.useState(false);

  const fetchBenchmarks = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterTechStack) params.set("techStack", filterTechStack);
    fetch(`/api/admin/benchmarks?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setBenchmarks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterCategory, filterTechStack]);

  React.useEffect(() => {
    fetchBenchmarks();
  }, [fetchBenchmarks]);

  const categories = React.useMemo(() => {
    const all = benchmarks.map((b) => b.category);
    return Array.from(new Set(all)).sort();
  }, [benchmarks]);

  function startEdit(b: Benchmark) {
    setEditingId(b.id);
    setEditState({
      lowHours: String(b.lowHours),
      highHours: String(b.highHours),
      tier: b.tier ?? "",
      notes: b.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/benchmarks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lowHours: parseFloat(editState.lowHours),
          highHours: parseFloat(editState.highHours),
          tier: editState.tier || null,
          notes: editState.notes || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBenchmarks((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
        );
        setEditingId(null);
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to update benchmark");
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this benchmark?")) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/benchmarks/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const updated = await res.json();
        setBenchmarks((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ...updated } : b))
        );
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to deactivate benchmark");
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    if (!addState.category || !addState.taskType || !addState.lowHours || !addState.highHours) {
      alert("Category, Task Type, Low Hours, and High Hours are required.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          techStack: addState.techStack,
          category: addState.category,
          taskType: addState.taskType,
          lowHours: parseFloat(addState.lowHours),
          highHours: parseFloat(addState.highHours),
          tier: addState.tier || undefined,
          notes: addState.notes || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBenchmarks((prev) => [created, ...prev]);
        setShowAddRow(false);
        setAddState(EMPTY_ADD);
      } else {
        const err = await res.json();
        alert(err.error ?? "Failed to create benchmark");
      }
    } finally {
      setAdding(false);
    }
  }

  const filteredBenchmarks = React.useMemo(
    () => benchmarks.filter((b) => b.isActive),
    [benchmarks]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Benchmark Management</h1>
        <p className="text-sm text-muted-foreground">Loading benchmarks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Benchmark Management</h1>
          <p className="text-sm text-muted-foreground">
            {filteredBenchmarks.length} benchmark
            {filteredBenchmarks.length !== 1 ? "s" : ""} active
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowAddRow(true);
            setAddState(EMPTY_ADD);
          }}
        >
          <Plus className="size-4 mr-1" />
          Add Benchmark
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <Select
          value={filterCategory || "__all__"}
          onValueChange={(v) => {
            if (v) setFilterCategory(v === "__all__" ? "" : v);
          }}
        >
          <SelectTrigger className="h-8 w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterTechStack || "__all__"}
          onValueChange={(v) => {
            if (v) setFilterTechStack(v === "__all__" ? "" : v);
          }}
        >
          <SelectTrigger className="h-8 w-48">
            <SelectValue placeholder="All stacks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All stacks</SelectItem>
            {TECH_STACKS.map((s) => (
              <SelectItem key={s} value={s}>
                {TECH_STACK_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Task Type</TableHead>
              <TableHead>Low–High Hrs</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Tech Stack</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Add row */}
            {showAddRow && (
              <TableRow className="bg-muted/40">
                <TableCell>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Category"
                    value={addState.category}
                    onChange={(e) =>
                      setAddState((s) => ({ ...s, category: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Task type"
                    value={addState.taskType}
                    onChange={(e) =>
                      setAddState((s) => ({ ...s, taskType: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Input
                      className="h-7 w-14 text-xs"
                      placeholder="Low"
                      type="number"
                      min={0}
                      value={addState.lowHours}
                      onChange={(e) =>
                        setAddState((s) => ({ ...s, lowHours: e.target.value }))
                      }
                    />
                    <Input
                      className="h-7 w-14 text-xs"
                      placeholder="High"
                      type="number"
                      min={0}
                      value={addState.highHours}
                      onChange={(e) =>
                        setAddState((s) => ({ ...s, highHours: e.target.value }))
                      }
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={addState.tier || "__none__"}
                    onValueChange={(v) => {
                      if (v) setAddState((s) => ({ ...s, tier: v === "__none__" ? "" : v }));
                    }}
                  >
                    <SelectTrigger className="h-7 w-20 text-xs">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {TIER_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={addState.techStack}
                    onValueChange={(v) => {
                      if (v) setAddState((s) => ({ ...s, techStack: v as TechStack }));
                    }}
                  >
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TECH_STACKS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TECH_STACK_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Notes"
                    value={addState.notes}
                    onChange={(e) =>
                      setAddState((s) => ({ ...s, notes: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => {
                        setShowAddRow(false);
                        setAddState(EMPTY_ADD);
                      }}
                      disabled={adding}
                    >
                      <X className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      onClick={handleAdd}
                      disabled={adding}
                    >
                      <Check className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {filteredBenchmarks.map((b) => {
              const isEditing = editingId === b.id;
              const isSaving = savingId === b.id;

              return (
                <TableRow key={b.id} className={!b.isActive ? "opacity-50" : ""}>
                  <TableCell className="text-sm font-medium">{b.category}</TableCell>
                  <TableCell className="text-sm">{b.taskType}</TableCell>
                  <TableCell className="text-sm">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Input
                          className="h-7 w-14 text-xs"
                          type="number"
                          min={0}
                          value={editState.lowHours}
                          onChange={(e) =>
                            setEditState((s) => ({ ...s, lowHours: e.target.value }))
                          }
                        />
                        <Input
                          className="h-7 w-14 text-xs"
                          type="number"
                          min={0}
                          value={editState.highHours}
                          onChange={(e) =>
                            setEditState((s) => ({ ...s, highHours: e.target.value }))
                          }
                        />
                      </div>
                    ) : (
                      `${b.lowHours}–${b.highHours}`
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select
                        value={editState.tier || "__none__"}
                        onValueChange={(v) => {
                          if (v) setEditState((s) => ({ ...s, tier: v === "__none__" ? "" : v }));
                        }}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue placeholder="Tier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {TIER_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : b.tier ? (
                      <Badge variant="secondary">{b.tier}</Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TECH_STACK_LABELS[b.techStack]}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                    {isEditing ? (
                      <Input
                        className="h-7 text-xs"
                        value={editState.notes}
                        onChange={(e) =>
                          setEditState((s) => ({ ...s, notes: e.target.value }))
                        }
                      />
                    ) : (
                      <span className="truncate block">{b.notes ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={cancelEdit}
                            disabled={isSaving}
                          >
                            <X className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => saveEdit(b.id)}
                            disabled={isSaving}
                          >
                            <Check className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => startEdit(b)}
                            disabled={isSaving || !b.isActive}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeactivate(b.id)}
                            disabled={isSaving || !b.isActive}
                          >
                            <Ban className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredBenchmarks.length === 0 && !showAddRow && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No benchmarks found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
