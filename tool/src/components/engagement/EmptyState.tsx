"use client"

import * as React from "react"
import Link from "next/link"
import { FolderOpenIcon, Upload, Sparkles, FileSpreadsheet, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HOW_IT_WORKS = [
  {
    step: 1,
    icon: Upload,
    title: "Upload TOR",
    description: "Upload your Terms of Reference document",
  },
  {
    step: 2,
    icon: Sparkles,
    title: "AI Analysis",
    description: "AI analyzes requirements and generates estimates",
  },
  {
    step: 3,
    icon: FileSpreadsheet,
    title: "Download Estimate",
    description: "Get a detailed Excel estimate with assumptions",
  },
]

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-20 text-center animate-fade-in">
      {/* Hero */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <FolderOpenIcon className="size-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">No engagements yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create your first engagement to get started with AI-powered estimation.
          </p>
        </div>
        <Button render={<Link href="/engagements/new" />}>
          Create Engagement
        </Button>
      </div>

      {/* How it works */}
      <div className="w-full max-w-2xl px-4">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How it works
        </p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:gap-0">
          {HOW_IT_WORKS.map(({ step, icon: Icon, title, description }, index) => (
            <React.Fragment key={step}>
              <div
                className={cn(
                  "flex flex-1 flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center",
                  "ring-1 ring-foreground/5 animate-fade-in"
                )}
                style={{ animationDelay: `${index * 100 + 100}ms`, opacity: 0 }}
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
              {index < HOW_IT_WORKS.length - 1 && (
                <>
                  {/* Desktop: horizontal arrow */}
                  <div className="hidden sm:flex items-center px-1 pt-4">
                    <ChevronRight className="size-4 text-muted-foreground/50 shrink-0" />
                  </div>
                  {/* Mobile: vertical arrow */}
                  <div className="flex sm:hidden justify-center">
                    <ChevronRight className="size-4 rotate-90 text-muted-foreground/50" />
                  </div>
                </>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
