"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon } from "lucide-react"
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

  // Derive unique categories from fetched data
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
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage benchmark reference ranges and account preferences.
        </p>
      </div>

      <Separator className="mb-6" />

      <Tabs defaultValue="benchmarks">
        <TabsList className="mb-6">
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="benchmarks">
          <BenchmarksTab />
        </TabsContent>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
