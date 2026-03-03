"use client"

import { useAuth } from "@/lib/auth-context"
import { LoginForm } from "@/components/login-form"
import { AppShell } from "@/components/app-shell"

export default function Home() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <AppShell />
}
