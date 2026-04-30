"use client"

import React from "react"
import { Users, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

type ShareRecord = {
  id: string
  email: string
  accessLevel: "READ_ONLY" | "FULL_ACCESS"
  createdAt: string
  user: { name: string; avatarUrl: string | null } | null
  createdBy: { name: string } | null
}

const ACCESS_LABEL: Record<string, string> = {
  READ_ONLY: "Read-only",
  FULL_ACCESS: "Full access",
}

const ACCESS_BADGE_CLASS: Record<string, string> = {
  READ_ONLY: "bg-muted text-muted-foreground border-border",
  FULL_ACCESS: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
}

export function SharePanel({ engagementId }: { engagementId: string }) {
  const [shares, setShares] = React.useState<ShareRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [email, setEmail] = React.useState("")
  const [accessLevel, setAccessLevel] = React.useState<"READ_ONLY" | "FULL_ACCESS">("READ_ONLY")
  const [adding, setAdding] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchShares = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/engagements/${engagementId}/shares`)
      if (res.ok) setShares(await res.json())
    } finally {
      setLoading(false)
    }
  }, [engagementId])

  React.useEffect(() => { fetchShares() }, [fetchShares])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/engagements/${engagementId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), accessLevel }),
      })
      if (res.ok) {
        setEmail("")
        await fetchShares()
      } else {
        const body = await res.json()
        setError(body.error ?? "Failed to add share")
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleChangeLevel(shareId: string, level: "READ_ONLY" | "FULL_ACCESS") {
    await fetch(`/api/engagements/${engagementId}/shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel: level }),
    })
    await fetchShares()
  }

  async function handleRevoke(shareId: string) {
    await fetch(`/api/engagements/${engagementId}/shares/${shareId}`, {
      method: "DELETE",
    })
    await fetchShares()
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <p className="text-sm font-medium text-foreground">Add people</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            required
          />
          <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as "READ_ONLY" | "FULL_ACCESS")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="READ_ONLY">Read-only</SelectItem>
              <SelectItem value="FULL_ACCESS">Full access</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={adding} size="sm">
            {adding ? <Loader2 className="size-4 animate-spin" /> : "Share"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">
          People with access
          {shares.length > 0 && (
            <span className="ml-1 text-muted-foreground">({shares.length})</span>
          )}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : shares.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
            <Users className="size-8 opacity-30" />
            <p>No one else has access yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border">
            {shares.map((share) => (
              <li key={share.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="truncate text-sm font-medium">
                    {share.user?.name ?? share.email}
                  </span>
                  {share.user?.name && (
                    <span className="truncate text-xs text-muted-foreground">{share.email}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={share.accessLevel}
                    onValueChange={(v) => handleChangeLevel(share.id, v as "READ_ONLY" | "FULL_ACCESS")}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="READ_ONLY">Read-only</SelectItem>
                      <SelectItem value="FULL_ACCESS">Full access</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevoke(share.id)}
                    title="Revoke access"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
