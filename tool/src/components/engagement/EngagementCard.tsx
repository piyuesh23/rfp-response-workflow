"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { EngagementStatus, TechStack } from "@/generated/prisma/client"

interface EngagementCardProps {
  id: string
  clientName: string
  projectName?: string | null
  techStack: TechStack
  status: EngagementStatus
  phaseProgress: { completed: number; total: number }
  updatedAt: Date
}

const statusConfig: Record<EngagementStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400" },
  COMPLETED: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400" },
  ARCHIVED: { label: "Archived", className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400" },
}

const techStackLabel: Record<TechStack, string> = {
  DRUPAL: "Drupal",
  DRUPAL_NEXTJS: "Drupal + Next.js",
  NEXTJS: "Next.js",
  REACT: "React",
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }
  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return "just now"
}

export function EngagementCard({
  id,
  clientName,
  projectName,
  techStack,
  status,
  phaseProgress,
  updatedAt,
}: EngagementCardProps) {
  const { completed, total } = phaseProgress
  const progressValue = total > 0 ? Math.round((completed / total) * 100) : 0
  const statusCfg = statusConfig[status]

  return (
    <Link href={`/engagements/${id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
      <Card className="h-full transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate font-semibold">{clientName}</CardTitle>
              {projectName && (
                <CardDescription className="truncate">{projectName}</CardDescription>
              )}
            </div>
            <Badge
              className={statusCfg.className}
              variant="outline"
            >
              {statusCfg.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            {techStackLabel[techStack]}
          </Badge>

          {total > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Phases</span>
                <span>{completed}/{total}</span>
              </div>
              <Progress value={progressValue} />
            </div>
          )}
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground">
          Updated {formatRelativeTime(updatedAt)}
        </CardFooter>
      </Card>
    </Link>
  )
}
