"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Inbox,
  FileCheck,
  BarChart3,
  CalendarDays,
  Users,
  UserCircle,
  ChevronDown,
  ChevronRight,
  Shield,
  Filter,
  ScanSearch,
  ShieldCheck,
  Settings,
} from "lucide-react"
import { useState } from "react"

export type PageKey =
  | "dashboard"
  | "nueva-solicitud"
  | "mis-solicitudes"
  | "validacion-uefa"
  | "bandeja-filtro1"
  | "bandeja-filtro2"
  | "bandeja-filtro3"
  | "revision-do"
  | "dictamenes"
  | "calendario"
  | "usuarios"
  | "configuracion"
  | "perfil"

interface SidebarProps {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  collapsed: boolean
}

interface MenuItem {
  key: PageKey
  label: string
  icon: React.ReactNode
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: "",
    items: [
      { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  },
  {
    label: "Solicitudes",
    items: [
      { key: "nueva-solicitud", label: "Nueva Solicitud", icon: <FilePlus className="h-4 w-4" /> },
      { key: "mis-solicitudes", label: "Mis Solicitudes", icon: <FileText className="h-4 w-4" /> },
    ],
  },
  {
    label: "Validacion",
    items: [
      { key: "validacion-uefa", label: "Validacion UEFA", icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    label: "Bandeja DO",
    items: [
      { key: "bandeja-filtro1", label: "Filtro 1", icon: <Filter className="h-4 w-4" /> },
      { key: "bandeja-filtro2", label: "Filtro 2", icon: <ScanSearch className="h-4 w-4" /> },
      { key: "bandeja-filtro3", label: "Filtro 3 (DG)", icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    label: "",
    items: [
      { key: "dictamenes", label: "Dictamenes Emitidos", icon: <FileCheck className="h-4 w-4" /> },

    ],
  },
  {
    label: "Catalogos",
    items: [
      { key: "calendario", label: "Calendario de Recepción", icon: <CalendarDays className="h-4 w-4" /> },
      { key: "usuarios", label: "Usuarios", icon: <Users className="h-4 w-4" /> },
    ],
  },
  {
    label: "",
    items: [
      { key: "configuracion", label: "Configuracion", icon: <Settings className="h-4 w-4" /> },
      { key: "perfil", label: "Perfil", icon: <UserCircle className="h-4 w-4" /> },
    ],
  },
]

export function AppSidebar({ currentPage, onNavigate, collapsed }: SidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Solicitudes: true,
    Validacion: true,
    "Bandeja DO": true,
    Catalogos: true,
  })

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
          <Shield className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-sidebar-foreground">SDTF</span>
            <span className="text-[10px] text-sidebar-foreground/60 leading-tight">Dictaminacion Tecnica</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-1">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-1">
              {group.label && !collapsed && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/70 transition-colors"
                >
                  {group.label}
                  {expandedGroups[group.label] ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              {(group.label === "" || expandedGroups[group.label] || collapsed) &&
                group.items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                      currentPage === item.key
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-[10px] text-sidebar-foreground/40 text-center">v1.0.0</p>
        </div>
      )}
    </aside>
  )
}
