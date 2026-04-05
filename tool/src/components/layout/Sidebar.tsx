"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Settings, LogOut, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface RecentEngagement {
  id: string
  clientName: string
  projectName?: string | null
}

export function SidebarContent() {
  const pathname = usePathname()
  const currentUser = useCurrentUser()
  const userName = currentUser?.name ?? "User"
  const userEmail = currentUser?.email ?? ""
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const [recentEngagements, setRecentEngagements] = React.useState<RecentEngagement[]>([])

  React.useEffect(() => {
    fetch("/api/engagements")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ id: string; clientName: string; projectName?: string | null }>) => {
        setRecentEngagements(
          data.slice(0, 5).map((e) => ({
            id: e.id,
            clientName: e.clientName,
            projectName: e.projectName,
          }))
        )
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Image src="/logo.svg" alt="RFP Copilot" width={24} height={24} className="shrink-0" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          RFP Copilot
        </span>
      </div>

      <Separator />

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 p-2 pt-3">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator className="my-2" />

      {/* Recent Engagements */}
      <div className="flex flex-col gap-1 px-4 pb-2">
        <div className="flex items-center gap-1.5 py-1">
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent
          </span>
        </div>
        {recentEngagements.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground/60">No engagements yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {recentEngagements.map((eng) => (
              <li key={eng.id}>
                <Link
                  href={`/engagements/${eng.id}`}
                  className={cn(
                    "block w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    pathname.includes(eng.id)
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {eng.clientName}{eng.projectName ? ` - ${eng.projectName}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      <Separator />

      {/* User section */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent/50 transition-colors outline-none">
            <Avatar size="sm">
              <AvatarImage src={currentUser?.image ?? ""} alt={userName} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col text-left">
              <span className="truncate text-xs font-medium text-foreground">
                {userName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => { window.location.href = "/api/auth/signout" }}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
