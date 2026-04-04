"use client"

import * as React from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  onMenuClick?: () => void
}

export function Header({ breadcrumbs = [], actions, onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      {/* Mobile hamburger — hidden on desktop */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <span className="text-muted-foreground select-none">/</span>
              )}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className={cn(
                    "truncate text-muted-foreground hover:text-foreground transition-colors",
                    idx === breadcrumbs.length - 1 && "font-medium text-foreground"
                  )}
                >
                  {crumb.label}
                </a>
              ) : (
                <span
                  className={cn(
                    "truncate text-muted-foreground",
                    idx === breadcrumbs.length - 1 && "font-medium text-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Spacer when no breadcrumbs */}
      {breadcrumbs.length === 0 && <div className="flex-1" />}

      {/* Right-side action slot */}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          <Separator orientation="vertical" className="h-5" />
          {actions}
        </div>
      )}
    </header>
  )
}
