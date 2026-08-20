"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { PanelLeftClose, PanelLeft, Bell } from "lucide-react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

export function AppHeader({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const { user, logout } = useAuth()
  const inicial = user?.rfc?.charAt(0).toUpperCase() ?? "?"
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 shadow-sm">
      <div className="flex items-center gap-3">

        {/* Toggle sidebar button */}
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-primary/8 px-3.5 py-2 text-primary/70 ring-1 ring-primary/20 transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:ring-primary hover:shadow-md active:scale-95"
        >
          {/* animated icon */}
          <span className="relative flex h-4 w-4 items-center justify-center">
            <PanelLeft
              className={`absolute h-4 w-4 transition-all duration-300 ${
                sidebarCollapsed ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
              }`}
            />
            <PanelLeftClose
              className={`absolute h-4 w-4 transition-all duration-300 ${
                sidebarCollapsed ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
              }`}
            />
          </span>

          {/* label */}
          <span className="hidden sm:block text-xs font-semibold tracking-wide transition-all duration-300">
            {sidebarCollapsed ? "Menú" : "Cerrar"}
          </span>

          {/* shine sweep on hover */}
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-foreground">
            Sistema para la Emisión de Dictaminaciones Técnicas Funcionales (SEDIT)
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </button>

        {/* User info */}
        <div className="hidden md:flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none shadow-sm">
            {inicial}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-card-foreground">{user?.nombre?.split(" ")[0] ?? user?.rfc ?? "—"}</span>
            <span className="text-[10px] text-muted-foreground">{user?.rol ?? "—"}</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmLogout(true)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 rounded-lg"
        >
          <span className="text-xs">Salir</span>
        </Button>
      </div>
      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); void logout() }}
        title="¿Cerrar sesión?"
        description="Se cerrará tu sesión actual y volverás a la pantalla de inicio."
        confirmLabel="Sí, cerrar sesión"
        variant="eliminar"
      />
    </header>
  )
}
