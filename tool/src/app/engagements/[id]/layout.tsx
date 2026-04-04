"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// Mock engagement data — replace with real fetch when API is ready
const MOCK_ENGAGEMENT = {
  clientName: "Acme Corporation",
  projectName: "Website Redesign",
  techStack: "DRUPAL_NEXTJS",
  status: "IN_PROGRESS",
}

const TECH_STACK_LABELS: Record<string, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
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
  { label: "Estimate", href: "/estimate" },
  { label: "Proposal", href: "/proposal" },
  { label: "Assumptions", href: "/assumptions" },
  { label: "Risks", href: "/risks" },
]

interface EngagementLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default function EngagementLayout({ children, params }: EngagementLayoutProps) {
  const { id } = React.use(params)
  const pathname = usePathname()
  const engagement = MOCK_ENGAGEMENT
  const basePath = `/engagements/${id}`

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
          </div>
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

      {children}
    </div>
  )
}
