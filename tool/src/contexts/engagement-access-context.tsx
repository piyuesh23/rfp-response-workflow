"use client"

import React from "react"
import type { ShareAccessLevel } from "@/generated/prisma/enums"

export type EffectiveAccessClient = {
  canRead: boolean
  canEdit: boolean
  source: "OWNER" | "GLOBAL" | "SHARE" | "NONE"
  shareLevel: ShareAccessLevel | null
}

const EngagementAccessContext = React.createContext<EffectiveAccessClient>({
  canRead: true,
  canEdit: false,
  source: "GLOBAL",
  shareLevel: null,
})

export function EngagementAccessProvider({
  access,
  children,
}: {
  access: EffectiveAccessClient
  children: React.ReactNode
}) {
  return (
    <EngagementAccessContext.Provider value={access}>
      {children}
    </EngagementAccessContext.Provider>
  )
}

export function useEngagementAccess(): EffectiveAccessClient {
  return React.useContext(EngagementAccessContext)
}
