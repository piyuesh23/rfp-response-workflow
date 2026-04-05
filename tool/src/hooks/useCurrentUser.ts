"use client"

import { useState, useEffect } from "react"

interface CurrentUser {
  name: string
  email: string
  image?: string
  role: string
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({
            name: data.user.name ?? "User",
            email: data.user.email ?? "",
            image: data.user.image ?? undefined,
            role: data.user.role ?? "VIEWER",
          })
        }
      })
      .catch(() => {})
  }, [])

  return user
}
