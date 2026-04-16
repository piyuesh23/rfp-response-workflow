"use client"

import * as React from "react"

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { SidebarContent } from "@/components/layout/Sidebar"
import { Header, type BreadcrumbItem } from "@/components/layout/Header"
import { ChatDrawer } from "@/components/chat/ChatDrawer"
import { useCurrentUser } from "@/hooks/useCurrentUser"

interface AppShellProps {
  children: React.ReactNode
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function AppShell({ children, breadcrumbs, actions }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const currentUser = useCurrentUser()
  const isLoggedIn = !!currentUser

  // No sidebar when logged out
  if (!isLoggedIn) {
    return (
      <div className="flex h-full min-h-screen flex-col">
        <main className="flex flex-1 flex-col p-6">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-screen overflow-x-hidden">
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden md:flex md:w-52 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r bg-background z-20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar — Sheet overlay */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-52 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col min-w-0 md:pl-52">
        <Header
          breadcrumbs={breadcrumbs}
          actions={actions}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex flex-1 flex-col p-6">
          {children}
        </main>
      </div>

      {/* Scoped RAG chat drawer — self-hides on routes without scope */}
      <ChatDrawer />
    </div>
  )
}
