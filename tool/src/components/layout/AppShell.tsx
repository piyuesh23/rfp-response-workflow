"use client"

import * as React from "react"

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { SidebarContent } from "@/components/layout/Sidebar"
import { Header, type BreadcrumbItem } from "@/components/layout/Header"

interface AppShellProps {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function AppShell({ children, breadcrumbs, actions }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex h-full min-h-screen">
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background z-20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar — Sheet overlay */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col md:pl-64">
        <Header
          breadcrumbs={breadcrumbs}
          actions={actions}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex flex-1 flex-col p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
