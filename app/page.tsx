"use client"

import { useAuth } from "@/lib/auth-context"
import { LoginForm, ForzarCambioContrasena } from "@/components/login-form"
import { AppShell } from "@/components/app-shell"

export default function Home() {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) return <LoginForm />
  if (user?.mustChangePassword) return <ForzarCambioContrasena />
  return <AppShell />
}
