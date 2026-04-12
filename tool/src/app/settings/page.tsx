"use client"

import * as React from "react"
import {
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
  Save,
  RotateCcw,
  Loader2,
  FileText,
  Shield,
  BarChart3,
  Layout,
} from "lucide-react"
import { useCurrentUser } from "@/hooks/useCurrentUser"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Benchmark {
  id: string
  techStack: string
  category: string
  taskType: string
  lowHours: number
  highHours: number
  tier: string | null
  notes: string | null
  sourceEngagementId: string | null
  isActive: boolean
}

interface PromptConfigSummary {
  key: string
  label: string
  category: string
  isDefault: boolean
  updatedAt: string | null
  updatedBy: string | null
}

interface PromptConfigVersion {
  id: string
  createdAt: string
  changeNote: string | null
  changedBy: string | null
}

interface PromptConfigDetail extends PromptConfigSummary {
  content: string
  versions: PromptConfigVersion[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TECH_STACKS = ["All", "DRUPAL", "DRUPAL_NEXTJS", "WORDPRESS", "WORDPRESS_NEXTJS", "NEXTJS", "REACT"]

const TECH_DISPLAY: Record<string, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  WORDPRESS: "WordPress",
  WORDPRESS_NEXTJS: "WordPress + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

// ─── Inline editable hours cell ───────────────────────────────────────────────

function EditableHours({
  value,
  onSave,
}: {
  value: number
  onSave: (v: number) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(value))
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (editing) {
      setDraft(String(value))
      ref.current?.focus()
      ref.current?.select()
    }
  }, [editing, value])

  function commit() {
    const parsed = parseFloat(draft)
    if (!isNaN(parsed) && parsed >= 0) onSave(parsed)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        ref={ref}
        type="number"
        min={0}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
        className="h-7 w-16 font-mono text-right text-sm"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="group rounded px-1.5 py-0.5 font-mono text-sm font-medium transition-colors hover:bg-muted/60 cursor-pointer"
    >
      {value}
      <span className="ml-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <PencilIcon className="inline size-2.5" />
      </span>
    </button>
  )
}

// ─── Add Benchmark Dialog ─────────────────────────────────────────────────────

interface AddBenchmarkDialogProps {
  categories: string[]
  onAdd: (b: Omit<Benchmark, "id" | "isActive">) => void
}

function AddBenchmarkDialog({ categories, onAdd }: AddBenchmarkDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    techStack: "DRUPAL",
    category: categories[0] ?? "",
    taskType: "",
    lowHours: "",
    highHours: "",
    notes: "",
    sourceEngagementId: "",
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const low = parseFloat(form.lowHours)
    const high = parseFloat(form.highHours)
    if (!form.taskType || isNaN(low) || isNaN(high)) return
    onAdd({
      techStack: form.techStack,
      category: form.category,
      taskType: form.taskType,
      lowHours: low,
      highHours: high,
      tier: null,
      notes: form.notes || null,
      sourceEngagementId: form.sourceEngagementId || null,
    })
    setOpen(false)
    setForm({
      techStack: "DRUPAL",
      category: categories[0] ?? "",
      taskType: "",
      lowHours: "",
      highHours: "",
      notes: "",
      sourceEngagementId: "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-1.5">
            <PlusIcon className="size-4" />
            Add Benchmark
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Benchmark</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="techStack">Tech Stack</Label>
              <Select
                value={form.techStack}
                onValueChange={(v) => { if (v) setForm((f) => ({ ...f, techStack: v })) }}
              >
                <SelectTrigger id="techStack" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["DRUPAL", "DRUPAL_NEXTJS", "WORDPRESS", "WORDPRESS_NEXTJS", "NEXTJS", "REACT"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {TECH_DISPLAY[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => { if (v) setForm((f) => ({ ...f, category: v })) }}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taskType">Task Type</Label>
            <Input
              id="taskType"
              placeholder="e.g. Content Type — Simple"
              value={form.taskType}
              onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lowHours">Low Hours</Label>
              <Input
                id="lowHours"
                type="number"
                min={0}
                step={0.5}
                placeholder="8"
                value={form.lowHours}
                onChange={(e) => setForm((f) => ({ ...f, lowHours: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="highHours">High Hours</Label>
              <Input
                id="highHours"
                type="number"
                min={0}
                step={0.5}
                placeholder="16"
                value={form.highHours}
                onChange={(e) => setForm((f) => ({ ...f, highHours: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Brief description of scope assumptions"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">Source Engagement ID</Label>
            <Input
              id="source"
              placeholder="e.g. eng-acme-2025 (optional)"
              value={form.sourceEngagementId}
              onChange={(e) =>
                setForm((f) => ({ ...f, sourceEngagementId: e.target.value }))
              }
            />
          </div>

          <DialogFooter className="-mx-4 -mb-4">
            <Button type="submit" size="sm">
              <CheckIcon className="size-4" />
              Add Benchmark
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Prompt Editor ────────────────────────────────────────────────────────────

function PromptEditor({
  configKey,
  isAdmin,
  onDirty,
}: {
  configKey: string
  isAdmin: boolean
  onDirty?: (dirty: boolean) => void
}) {
  const [config, setConfig] = React.useState<PromptConfigDetail | null>(null)
  const [content, setContent] = React.useState("")
  const [originalContent, setOriginalContent] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [showVersions, setShowVersions] = React.useState(false)
  const [versions, setVersions] = React.useState<PromptConfigVersion[]>([])

  async function fetchConfig() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/prompt-configs/${encodeURIComponent(configKey)}`)
      if (res.ok) {
        const data: PromptConfigDetail = await res.json()
        setConfig(data)
        setContent(data.content)
        setOriginalContent(data.content)
        setVersions(data.versions ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchConfig()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey])

  React.useEffect(() => {
    onDirty?.(content !== originalContent)
  }, [content, originalContent, onDirty])

  async function handleSave() {
    const changeNote = window.prompt("Change note (optional):") ?? undefined
    setSaving(true)
    try {
      await fetch(`/api/admin/prompt-configs/${encodeURIComponent(configKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, changeNote }),
      })
      await fetchConfig()
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!window.confirm("Reset to default? This will overwrite your changes.")) return
    await fetch(`/api/admin/prompt-configs/${encodeURIComponent(configKey)}/reset`, {
      method: "POST",
    })
    await fetchConfig()
  }

  async function handleRestore(versionId: string) {
    if (!window.confirm("Restore this version? Current content will be saved as a new version.")) return
    await fetch(
      `/api/admin/prompt-configs/${encodeURIComponent(configKey)}/versions/${versionId}/restore`,
      { method: "POST" }
    )
    await fetchConfig()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 className="size-4 mr-2 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Failed to load config.
      </div>
    )
  }

  const isDirty = content !== originalContent

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h3 className="font-medium text-sm">{config.label}</h3>
          <p className="text-xs text-muted-foreground">
            {config.isDefault
              ? "Default (unchanged)"
              : `Edited by ${config.updatedBy ?? "unknown"} at ${formatDate(config.updatedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <Badge variant="outline" className="text-xs">
              Read-only
            </Badge>
          )}
          {isAdmin && !config.isDefault && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="size-3.5 mr-1.5" />
              Reset to Default
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="size-3.5 mr-1.5" />
              )}
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Textarea editor */}
      <textarea
        className="flex-1 min-h-[400px] rounded-md border bg-muted/30 p-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={!isAdmin}
      />

      {/* Version history */}
      <div className="mt-3 border-t pt-3">
        <button
          type="button"
          onClick={() => setShowVersions(!showVersions)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Version History ({versions.length})
        </button>
        {showVersions && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {versions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No version history yet.</p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-xs py-1 border-b last:border-b-0"
                >
                  <span className="text-muted-foreground">
                    {formatDate(v.createdAt)}
                    {v.changedBy ? ` — ${v.changedBy}` : ""}
                    {v.changeNote ? ` — ${v.changeNote}` : " — No note"}
                  </span>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => handleRestore(v.id)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Config Category Tab ──────────────────────────────────────────────────────

function ConfigCategoryTab({
  categories,
  isAdmin,
}: {
  categories: string[]
  isAdmin: boolean
}) {
  const [configs, setConfigs] = React.useState<PromptConfigSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      try {
        const results = await Promise.all(
          categories.map((cat) =>
            fetch(`/api/admin/prompt-configs?category=${encodeURIComponent(cat)}`)
              .then((r) => (r.ok ? r.json() : []))
          )
        )
        const all: PromptConfigSummary[] = results.flat()
        setConfigs(all)
        if (all.length > 0 && !selectedKey) {
          setSelectedKey(all[0].key)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.join(",")])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 className="size-4 mr-2 animate-spin" />
        Loading configs…
      </div>
    )
  }

  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No configs found for this category.
      </div>
    )
  }

  return (
    <div className="flex gap-0 rounded-xl border overflow-hidden h-[600px]">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r bg-muted/20 overflow-y-auto">
        <ul className="py-1">
          {configs.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setSelectedKey(c.key)}
                className={[
                  "w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted/60",
                  selectedKey === c.key ? "bg-muted/80 font-medium" : "",
                ].join(" ")}
              >
                <span className="block truncate">{c.label}</span>
                {!c.isDefault && (
                  <span className="block text-xs text-amber-600 mt-0.5">Modified</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Editor panel */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedKey ? (
          <PromptEditor configKey={selectedKey} isAdmin={isAdmin} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a config from the sidebar.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Benchmarks Tab ───────────────────────────────────────────────────────────

function BenchmarksTab() {
  const currentUser = useCurrentUser()
  const isAdmin = currentUser?.role === "ADMIN"
  const [data, setData] = React.useState<Benchmark[]>([])
  const [loading, setLoading] = React.useState(true)
  const [techFilter, setTechFilter] = React.useState("All")
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)

  async function fetchBenchmarks() {
    setLoading(true)
    try {
      const res = await fetch("/api/benchmarks")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchBenchmarks()
  }, [])

  const uniqueCategories = React.useMemo(
    () => Array.from(new Set(data.map((b) => b.category))).sort(),
    [data]
  )

  const filtered = data.filter((b) => {
    const matchTech = techFilter === "All" || b.techStack === techFilter
    const matchCat = categoryFilter === "all" || b.category === categoryFilter
    return matchTech && matchCat
  })

  async function handleAdd(b: Omit<Benchmark, "id" | "isActive">) {
    await fetch("/api/admin/benchmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b),
    })
    await fetchBenchmarks()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/benchmarks/${id}`, { method: "DELETE" })
    setDeleteConfirm(null)
    await fetchBenchmarks()
  }

  async function handleLowHours(id: string, val: number) {
    await fetch(`/api/admin/benchmarks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lowHours: val }),
    })
    await fetchBenchmarks()
  }

  async function handleHighHours(id: string, val: number) {
    await fetch(`/api/admin/benchmarks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highHours: val }),
    })
    await fetchBenchmarks()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={techFilter} onValueChange={(v) => { if (v) setTechFilter(v) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tech Stack" />
          </SelectTrigger>
          <SelectContent>
            {TECH_STACKS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "All" ? "All Stacks" : TECH_DISPLAY[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => { if (v) setCategoryFilter(v) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdmin && (
          <div className="ml-auto">
            <AddBenchmarkDialog categories={uniqueCategories} onAdd={handleAdd} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-medium text-muted-foreground">Stack</TableHead>
              <TableHead className="font-medium text-muted-foreground">Category</TableHead>
              <TableHead className="font-medium text-muted-foreground">Task Type</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">Low Hrs</TableHead>
              <TableHead className="font-medium text-muted-foreground text-right">High Hrs</TableHead>
              <TableHead className="font-medium text-muted-foreground">Notes</TableHead>
              <TableHead className="font-medium text-muted-foreground">Source</TableHead>
              {isAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                  Loading benchmarks…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                  No benchmarks match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/30 transition-colors group/row">
                  <TableCell>
                    <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">
                      {TECH_DISPLAY[b.techStack] ?? b.techStack}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                      {b.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[260px] whitespace-normal leading-snug">
                    {b.taskType}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <EditableHours
                        value={b.lowHours}
                        onSave={(v) => handleLowHours(b.id, v)}
                      />
                    ) : (
                      <span className="font-mono text-sm">{b.lowHours}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin ? (
                      <EditableHours
                        value={b.highHours}
                        onSave={(v) => handleHighHours(b.id, v)}
                      />
                    ) : (
                      <span className="font-mono text-sm">{b.highHours}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[220px] whitespace-normal leading-snug">
                    {b.notes || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {b.sourceEngagementId ?? (
                      <span className="italic">—</span>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {deleteConfirm === b.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(b.id)}
                            className="rounded p-1 text-destructive hover:bg-destructive/10 transition-colors"
                            title="Confirm delete"
                          >
                            <CheckIcon className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                            title="Cancel"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(b.id)}
                          className="rounded p-1 text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                          title="Delete benchmark"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} benchmark{filtered.length !== 1 ? "s" : ""} shown
        {filtered.length !== data.length && ` (${data.length} total)`}.
        {isAdmin ? " Hours cells are click-to-edit." : " Read-only view. Contact an admin to edit benchmarks."}
      </p>
    </div>
  )
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

function AccountTab() {
  const currentUser = useCurrentUser()
  const userName = currentUser?.name ?? "—"
  const userEmail = currentUser?.email ?? "—"
  const userRole = currentUser?.role ?? "VIEWER"

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Current user */}
      <div className="rounded-xl border p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Current User</h3>
        <Separator />
        <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{userName}</span>

          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{userEmail}</span>

          <span className="text-muted-foreground">Role</span>
          <span>
            <Badge variant="secondary" className="text-xs">
              {userRole}
            </Badge>
          </span>
        </div>
      </div>

      {/* User management — admin only placeholder */}
      <div className="rounded-xl border p-5 flex flex-col gap-4 opacity-60">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">User Management</h3>
          <Badge variant="outline" className="text-xs">
            Admin only
          </Badge>
        </div>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Multi-user management is coming soon. This section will allow admins to
          invite team members, assign roles, and revoke access.
        </p>
        <Button variant="outline" size="sm" disabled className="w-fit">
          Coming soon
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const currentUser = useCurrentUser()
  const isAdmin = currentUser?.role === "ADMIN"

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage prompt configurations, CARL rules, benchmark reference ranges, and output templates.
        </p>
      </div>

      <Separator className="mb-6" />

      <Tabs defaultValue="prompts">
        <TabsList className="mb-6">
          <TabsTrigger value="prompts" className="gap-1.5">
            <FileText className="size-3.5" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Shield className="size-3.5" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Benchmarks
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <Layout className="size-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts">
          <div className="flex flex-col gap-2 mb-4">
            <p className="text-sm text-muted-foreground">
              Base system prompts and phase-specific prompts used by the AI agents.
              {!isAdmin && " Read-only — contact an admin to make changes."}
            </p>
          </div>
          <ConfigCategoryTab
            categories={["SYSTEM_BASE", "PHASE_PROMPT"]}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="rules">
          <div className="flex flex-col gap-2 mb-4">
            <p className="text-sm text-muted-foreground">
              CARL rules that govern estimation quality and coverage enforcement.
              {!isAdmin && " Read-only — contact an admin to make changes."}
            </p>
          </div>
          <ConfigCategoryTab
            categories={["CARL_RULES"]}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="benchmarks">
          <BenchmarksTab />
        </TabsContent>

        <TabsContent value="templates">
          <div className="flex flex-col gap-2 mb-4">
            <p className="text-sm text-muted-foreground">
              Output structure templates used to format artefacts produced by each phase.
              {!isAdmin && " Read-only — contact an admin to make changes."}
            </p>
          </div>
          <ConfigCategoryTab
            categories={["TEMPLATE"]}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
