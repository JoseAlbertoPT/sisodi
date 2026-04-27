"use client"

import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut, PanelLeftClose, PanelLeft, Bell } from "lucide-react"

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

export function AppHeader({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const { user, logout } = useAuth()

  const inicial = user?.rfc?.charAt(0).toUpperCase() ?? "?"

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-foreground">
            Sistema de Solicitudes de Dictaminación de Justificaciones
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>

        {}
        <div className="hidden md:flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none">
            {inicial}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-card-foreground">
              {user?.rfc ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {user?.rol ?? "—"}
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </Button>
      </div>
    </header>
  )
}