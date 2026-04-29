"use client"

import { useAuth } from "@/lib/auth-context"
import { LoginForm, ForzarCambioContrasena } from "@/components/login-form"
import { AppShell } from "@/components/app-shell"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginForm />
  if (user?.mustChangePassword) return <ForzarCambioContrasena />
  return <AppShell />
}
