"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Trash2, Share2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { EngagementAccessProvider, type EffectiveAccessClient } from "@/contexts/engagement-access-context"
import { SharePanel } from "@/components/engagement/SharePanel"

const TECH_STACK_LABELS: Record<string, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  WORDPRESS: "WordPress",
  WORDPRESS_NEXTJS: "WordPress + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  ARCHIVED: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
}

const TAB_ITEMS = [
  { label: "Overview", href: "" },
  { label: "Files", href: "/files" },
  { label: "Estimate", href: "/estimate" },
  { label: "Proposal", href: "/proposal" },
  { label: "Assumptions", href: "/assumptions" },
  { label: "Risks", href: "/risks" },
]

interface Engagement {
  clientName: string
  projectName?: string | null
  techStack: string
  status: string
  effectiveAccess?: EffectiveAccessClient
}

interface EngagementLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default function EngagementLayout({ children, params }: EngagementLayoutProps) {
  const { id } = React.use(params)
  const pathname = usePathname()
  const router = useRouter()
  const basePath = `/engagements/${id}`

  const [engagement, setEngagement] = React.useState<Engagement | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [shareOpen, setShareOpen] = React.useState(false)
  const effectiveAccess: EffectiveAccessClient = engagement?.effectiveAccess ?? {
    canRead: true,
    canEdit: true,
    source: "GLOBAL",
    shareLevel: null,
  }

  React.useEffect(() => {
    fetch(`/api/engagements/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEngagement(data))
      .catch(() => setEngagement(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading engagement...</div>
  }

  if (!engagement) {
    return <div className="flex items-center justify-center py-12 text-sm text-destructive">Engagement not found</div>
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Engagement header */}
      <div className="flex flex-col gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {engagement.clientName}
            </h1>
            {engagement.projectName && (
              <p className="text-sm text-muted-foreground">{engagement.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border text-xs">
              {TECH_STACK_LABELS[engagement.techStack] ?? engagement.techStack}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border text-xs",
                STATUS_BADGE_CLASSES[engagement.status] ?? "bg-muted text-muted-foreground"
              )}
            >
              {STATUS_LABELS[engagement.status] ?? engagement.status}
            </Badge>
            {effectiveAccess.canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShareOpen(true)}
                title="Share engagement"
              >
                <Share2 className="size-4" />
              </Button>
            )}
            {effectiveAccess.canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                disabled={deleting}
                onClick={async () => {
                  if (!confirm(`Delete "${engagement.clientName}"? This will permanently remove all phases, artefacts, and files. This cannot be undone.`)) return
                  setDeleting(true)
                  try {
                    const res = await fetch(`/api/engagements/${id}`, { method: "DELETE" })
                    if (res.ok) {
                      router.push("/")
                    } else {
                      const err = await res.json()
                      alert(err.error ?? "Failed to delete engagement")
                    }
                  } catch {
                    alert("Failed to delete engagement")
                  } finally {
                    setDeleting(false)
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          {/* Share sheet */}
          <Sheet open={shareOpen} onOpenChange={setShareOpen}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Share "{engagement.clientName}"</SheetTitle>
              </SheetHeader>
              <SharePanel engagementId={id} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-0 border-b">
          {TAB_ITEMS.map((tab) => {
            const href = `${basePath}${tab.href}`
            const isActive =
              tab.href === ""
                ? pathname === basePath || pathname === `${basePath}/`
                : pathname.startsWith(href)

            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors",
                  "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-t-full",
                  isActive
                    ? "text-foreground after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground after:bg-transparent"
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      <Separator className="mb-4" />

      <EngagementAccessProvider access={effectiveAccess}>
        {children}
      </EngagementAccessProvider>
    </div>
  )
}
