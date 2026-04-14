"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GitMerge, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Account {
  id: string;
  canonicalName: string;
  industry: string;
  region: string | null;
  accountTier: string | null;
  createdAt: string;
  _count: { engagements: number };
  winRate?: number | null;
  outcomesRecorded?: number;
  totalDealValue?: number;
  wonRevenue?: number;
  lastEngagementDate?: string | null;
  primaryTechStack?: string | null;
}

interface SimilarGroup {
  accounts: Account[];
  similarity: string;
}

type SortKey =
  | "canonicalName"
  | "industry"
  | "accountTier"
  | "engagements"
  | "winRate"
  | "totalDealValue"
  | "wonRevenue"
  | "lastEngagementDate"
  | "primaryTechStack";

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

import { industryLabels, regionLabels, tierLabels, techStackLabels } from "@/lib/engagement-labels";

const industryColors: Record<string, string> = {
  HEALTHCARE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  FINTECH: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  EDUCATION: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  GOVERNMENT: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  MEDIA: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  ECOMMERCE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  NONPROFIT: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  MANUFACTURING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  PROFESSIONAL_SERVICES: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  TECHNOLOGY: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  ENERGY: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  LEGAL: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const INDUSTRY_OPTIONS = [
  "ALL",
  "HEALTHCARE",
  "FINTECH",
  "EDUCATION",
  "GOVERNMENT",
  "MEDIA",
  "ECOMMERCE",
  "NONPROFIT",
  "MANUFACTURING",
  "PROFESSIONAL_SERVICES",
  "TECHNOLOGY",
  "ENERGY",
  "LEGAL",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatCurrencyK(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function IndustryBadge({ industry }: { industry: string }) {
  const colorClass = industryColors[industry] ?? industryColors.OTHER;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {industryLabels[industry] ?? industry}
    </span>
  );
}

function WinRateIndicator({ winRate, outcomesRecorded }: { winRate: number | null | undefined; outcomesRecorded: number | undefined }) {
  if (winRate == null) return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    winRate >= 60
      ? "text-green-600 dark:text-green-400"
      : winRate >= 40
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  return (
    <span className={`text-sm font-medium ${color}`} title={`${outcomesRecorded ?? 0} outcomes recorded`}>
      {Math.round(winRate)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function getSortValue(acc: Account, key: SortKey): string | number | null {
  switch (key) {
    case "canonicalName":
      return acc.canonicalName.toLowerCase();
    case "industry":
      return acc.industry;
    case "accountTier":
      return acc.accountTier ?? "";
    case "engagements":
      return acc._count.engagements;
    case "winRate":
      return acc.winRate ?? -1;
    case "totalDealValue":
      return acc.totalDealValue ?? -1;
    case "wonRevenue":
      return acc.wonRevenue ?? -1;
    case "lastEngagementDate":
      return acc.lastEngagementDate ? new Date(acc.lastEngagementDate).getTime() : -1;
    case "primaryTechStack":
      return acc.primaryTechStack ?? "";
    default:
      return null;
  }
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="size-3 opacity-40" />;
  return sortDir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />;
}

// ---------------------------------------------------------------------------
// New Account inline form
// ---------------------------------------------------------------------------

interface NewAccountFormProps {
  onCreated: (account: Account) => void;
  onClose: () => void;
}

function NewAccountForm({ onCreated, onClose }: NewAccountFormProps) {
  const [name, setName] = React.useState("");
  const [industry, setIndustry] = React.useState("OTHER");
  const [tier, setTier] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalName: name.trim(),
          industry: industry || undefined,
          accountTier: tier || undefined,
          region: region || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError((body as { error?: string }).error ?? "Failed to create account");
        return;
      }
      const created = await res.json() as Account;
      onCreated(created);
    } finally {
      setSaving(false);
    }
  }

  void onClose;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Account Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme Corporation"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Industry</label>
          <Select value={industry} onValueChange={(v) => { if (v) setIndustry(v); }}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.filter((o) => o !== "ALL").map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {industryLabels[opt] ?? opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tier</label>
          <Select value={tier} onValueChange={(v) => { if (v) setTier(v); }}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              <SelectItem value="MID_MARKET">Mid-Market</SelectItem>
              <SelectItem value="SMB">SMB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Region</label>
          <Select value={region} onValueChange={(v) => { if (v) setRegion(v); }}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NA">North America</SelectItem>
              <SelectItem value="EMEA">EMEA</SelectItem>
              <SelectItem value="APAC">Asia Pacific</SelectItem>
              <SelectItem value="LATAM">Latin America</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? "Creating..." : "Create Account"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Duplicates dialog
// ---------------------------------------------------------------------------

interface DuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: SimilarGroup[];
  loading: boolean;
}

function DuplicatesDialog({ open, onOpenChange, groups, loading }: DuplicatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Potential Duplicate Accounts</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Scanning for duplicates...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No duplicate accounts found.</p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {groups.map((group, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {group.similarity}
                </p>
                <div className="space-y-1">
                  {group.accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="font-medium">{acc.canonicalName}</span>
                      <span className="text-xs text-muted-foreground">
                        {acc._count.engagements} engagement{acc._count.engagements !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sortable column header
// ---------------------------------------------------------------------------

interface SortableHeaderProps {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}

function SortableHeader({ col, sortKey, sortDir, onSort, children, className }: SortableHeaderProps) {
  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/30 ${className ?? ""}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {children}
        <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </span>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filterIndustry, setFilterIndustry] = React.useState("ALL");
  const [quickFilter, setQuickFilter] = React.useState<"all" | "highValue" | "needsOutcome">("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("lastEngagementDate");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [newAccountOpen, setNewAccountOpen] = React.useState(false);
  const [dupOpen, setDupOpen] = React.useState(false);
  const [dupGroups, setDupGroups] = React.useState<SimilarGroup[]>([]);
  const [dupLoading, setDupLoading] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/accounts")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Account[]) => setAccounts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  const filtered = React.useMemo(() => {
    let list = accounts.filter((acc) => {
      const matchesSearch =
        search === "" ||
        acc.canonicalName.toLowerCase().includes(search.toLowerCase());
      const matchesIndustry =
        filterIndustry === "ALL" || acc.industry === filterIndustry;
      return matchesSearch && matchesIndustry;
    });

    // Quick filters
    if (quickFilter === "highValue") {
      list = list.filter(
        (acc) => (acc.totalDealValue ?? 0) > 100_000 || acc._count.engagements > 5
      );
    } else if (quickFilter === "needsOutcome") {
      list = list.filter(
        (acc) => acc._count.engagements > 0 && (acc.outcomesRecorded ?? 0) < acc._count.engagements
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });

    return list;
  }, [accounts, search, filterIndustry, quickFilter, sortKey, sortDir]);

  // Summary totals
  const totalPipeline = filtered.reduce((s, a) => s + (a.totalDealValue ?? 0), 0);
  const totalWon = filtered.reduce((s, a) => s + (a.wonRevenue ?? 0), 0);

  function handleCreated(acc: Account) {
    setAccounts((prev) => [acc, ...prev]);
    setNewAccountOpen(false);
  }

  async function handleFindDuplicates() {
    setDupOpen(true);
    setDupLoading(true);
    try {
      const res = await fetch("/api/accounts/similar");
      if (res.ok) {
        const data = await res.json() as SimilarGroup[];
        setDupGroups(data);
      }
    } finally {
      setDupLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFindDuplicates}
          >
            <GitMerge className="size-3.5 mr-1.5" />
            Find Duplicates
          </Button>
          <Dialog open={newAccountOpen} onOpenChange={setNewAccountOpen}>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus className="size-3.5 mr-1.5" />
                  New Account
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Account</DialogTitle>
              </DialogHeader>
              <NewAccountForm
                onCreated={handleCreated}
                onClose={() => setNewAccountOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          className="h-8 w-56"
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={filterIndustry}
          onValueChange={(v) => { if (v) setFilterIndustry(v); }}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt === "ALL" ? "All Industries" : (industryLabels[opt] ?? opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quick filter buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={quickFilter === "all" ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setQuickFilter("all")}
          >
            All
          </Button>
          <Button
            variant={quickFilter === "highValue" ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setQuickFilter("highValue")}
          >
            High Value
          </Button>
          <Button
            variant={quickFilter === "needsOutcome" ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setQuickFilter("needsOutcome")}
          >
            Needs Outcome
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading accounts...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader col="canonicalName" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                  Account Name
                </SortableHeader>
                <SortableHeader col="industry" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                  Industry
                </SortableHeader>
                <SortableHeader col="accountTier" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                  Tier
                </SortableHeader>
                <SortableHeader col="engagements" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-center">
                  Engs
                </SortableHeader>
                <SortableHeader col="winRate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-center">
                  Win Rate
                </SortableHeader>
                <SortableHeader col="totalDealValue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right">
                  Pipeline
                </SortableHeader>
                <SortableHeader col="wonRevenue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right">
                  Won
                </SortableHeader>
                <SortableHeader col="lastEngagementDate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                  Last Activity
                </SortableHeader>
                <SortableHeader col="primaryTechStack" sortKey={sortKey} sortDir={sortDir} onSort={handleSort}>
                  Primary Stack
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground py-8"
                  >
                    {accounts.length === 0
                      ? "No accounts yet"
                      : "No accounts match your filters"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((acc) => (
                  <TableRow
                    key={acc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/accounts/${acc.id}`)}
                  >
                    <TableCell className="font-medium text-sm">
                      {acc.canonicalName}
                    </TableCell>
                    <TableCell>
                      <IndustryBadge industry={acc.industry} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {acc.accountTier ? (tierLabels[acc.accountTier] ?? acc.accountTier) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {acc._count.engagements}
                    </TableCell>
                    <TableCell className="text-center">
                      <WinRateIndicator winRate={acc.winRate} outcomesRecorded={acc.outcomesRecorded} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrencyK(acc.totalDealValue)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium text-green-700 dark:text-green-400">
                      {formatCurrencyK(acc.wonRevenue)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatRelativeDate(acc.lastEngagementDate)}
                    </TableCell>
                    <TableCell>
                      {acc.primaryTechStack ? (
                        <Badge variant="outline" className="text-xs">
                          {techStackLabels[acc.primaryTechStack] ?? acc.primaryTechStack}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary row */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
          <span>{filtered.length} account{filtered.length !== 1 ? "s" : ""}</span>
          <span>
            Pipeline:{" "}
            <span className="font-medium text-foreground">{formatCurrencyK(totalPipeline)}</span>
          </span>
          <span>
            Won Revenue:{" "}
            <span className="font-medium text-green-700 dark:text-green-400">
              {formatCurrencyK(totalWon)}
            </span>
          </span>
        </div>
      )}

      {/* Duplicates dialog */}
      <DuplicatesDialog
        open={dupOpen}
        onOpenChange={setDupOpen}
        groups={dupGroups}
        loading={dupLoading}
      />
    </div>
  );
}
