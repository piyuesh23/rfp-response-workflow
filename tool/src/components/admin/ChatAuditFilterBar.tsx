"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RANGE_OPTIONS = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "all", label: "All time" },
] as const;

const SCOPE_OPTIONS = [
  { value: "all", label: "All scopes" },
  { value: "ENGAGEMENT", label: "Engagement" },
  { value: "ADMIN", label: "Admin" },
] as const;

export function ChatAuditFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentScope = searchParams.get("scope") ?? "all";
  const currentRange = searchParams.get("range") ?? "24h";
  const currentQ = searchParams.get("q") ?? "";

  const [qInput, setQInput] = React.useState(currentQ);

  // Keep local input in sync when URL changes externally (e.g. pagination nav).
  React.useEffect(() => {
    setQInput(currentQ);
  }, [currentQ]);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    // Reset pagination cursor when filters change.
    params.delete("cursor");
    const qs = params.toString();
    router.push(qs ? `/admin/chat-audit?${qs}` : "/admin/chat-audit");
  }

  function handleScope(val: string | null) {
    if (!val) return;
    pushParams({ scope: val === "all" ? null : val });
  }

  function handleRange(val: string | null) {
    if (!val) return;
    pushParams({ range: val === "24h" ? null : val });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    pushParams({ q: qInput.trim() || null });
  }

  function handleClear() {
    setQInput("");
    router.push("/admin/chat-audit");
  }

  const hasFilters =
    currentScope !== "all" || currentRange !== "24h" || currentQ !== "";

  return (
    <form
      onSubmit={handleSearchSubmit}
      className="flex flex-wrap items-center gap-2"
    >
      <Select value={currentScope} onValueChange={handleScope}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Scope" />
        </SelectTrigger>
        <SelectContent>
          {SCOPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentRange} onValueChange={handleRange}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
        placeholder="Search question text..."
        className="h-8 w-64"
      />
      <Button type="submit" size="sm" variant="outline" className="h-8">
        Search
      </Button>
      {hasFilters && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={handleClear}
        >
          Clear
        </Button>
      )}
    </form>
  );
}
