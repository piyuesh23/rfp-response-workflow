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
import { Plus, GitMerge } from "lucide-react";

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
}

interface SimilarGroup {
  accounts: Account[];
  similarity: string;
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const industryLabels: Record<string, string> = {
  HEALTHCARE: "Healthcare",
  FINTECH: "Fintech",
  EDUCATION: "Education",
  GOVERNMENT: "Government",
  MEDIA: "Media",
  ECOMMERCE: "E-Commerce",
  NONPROFIT: "Nonprofit",
  MANUFACTURING: "Manufacturing",
  PROFESSIONAL_SERVICES: "Professional Services",
  TECHNOLOGY: "Technology",
  ENERGY: "Energy",
  LEGAL: "Legal",
  OTHER: "Other",
};

const regionLabels: Record<string, string> = {
  NA: "North America",
  EMEA: "EMEA",
  APAC: "Asia Pacific",
  LATAM: "Latin America",
};

const tierLabels: Record<string, string> = {
  ENTERPRISE: "Enterprise",
  MID_MARKET: "Mid-Market",
  SMB: "SMB",
};

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
// Main page
// ---------------------------------------------------------------------------

export default function AdminAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filterIndustry, setFilterIndustry] = React.useState("ALL");
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

  const filtered = React.useMemo(() => {
    return accounts.filter((acc) => {
      const matchesSearch =
        search === "" ||
        acc.canonicalName.toLowerCase().includes(search.toLowerCase());
      const matchesIndustry =
        filterIndustry === "ALL" || acc.industry === filterIndustry;
      return matchesSearch && matchesIndustry;
    });
  }, [accounts, search, filterIndustry]);

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
      <div className="flex flex-wrap gap-3">
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
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading accounts...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="text-center">Engagements</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
                    <TableCell className="text-sm text-muted-foreground">
                      {acc.region ? (regionLabels[acc.region] ?? acc.region) : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {acc._count.engagements}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {acc.winRate != null ? `${Math.round(acc.winRate * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(acc.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
