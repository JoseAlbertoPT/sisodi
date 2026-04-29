"use client"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { fetchMyMenus, type MenuNode } from "@/lib/permisos-api"
import { useState, useEffect, useCallback, useMemo } from "react"
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  FileCheck,
  CalendarDays,
  Users,
  ShieldCheck,
  Filter,
  ScanSearch,
  Settings,
  Menu as MenuIcon,
  ChevronRight,
  ChevronUp,
  X,
  LogOut,
  UserCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  onToggleSidebar?: () => void
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FilePlus,
  FileText,
  FileCheck,
  CalendarDays,
  Users,
  ShieldCheck,
  Filter,
  ScanSearch,
  Settings,
}

function getIconForNode(node: MenuNode): React.ReactNode {
  const Icon = (node.icon && ICON_MAP[node.icon]) || MenuIcon
  return <Icon className="h-4 w-4" />
}

function collectLeafNodes(nodes: MenuNode[]): MenuNode[] {
  const out: MenuNode[] = []
  for (const n of nodes) {
    if (n.key) out.push(n)
    if (n.children?.length) out.push(...collectLeafNodes(n.children))
  }
  return out
}

const SECTION_DEFS = [
  {
    id: "justificaciones",
    label: "Justificaciones",
    keys: ["dashboard", "nueva-solicitud", "mis-solicitudes", "validacion-uefa"] as PageKey[],
  },
  {
    id: "gestion",
    label: "Gestión  DGDO ",
    keys: ["bandeja-filtro1", "bandeja-filtro2", "bandeja-filtro3", "dictamenes"] as PageKey[],
  },
  {
    id: "configuracion",
    label: "Configuración",
    keys: ["calendario", "usuarios", "configuracion"] as PageKey[],
  },
]

function SidebarItem({
  label,
  icon,
  isActive,
  onClick,
  collapsed,
}: {
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  collapsed: boolean
}) {
  const [hovered, setHovered] = useState(false)

  const style: React.CSSProperties = isActive
    ? { backgroundColor: "#283C2A", color: "#FFFFFF" }
    : hovered
    ? { backgroundColor: "#832B56", color: "#FFFFFF" }
    : {}

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className="flex w-full justify-center rounded p-2 transition-colors"
            style={style}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label={label}
          >
            <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded pl-1 pr-2 py-2 text-[13px] font-medium transition-colors"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="shrink-0 mt-0.5 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="leading-tight">{label}</span>
    </button>
  )
}

function SidebarSection({
  label,
  items,
  currentPage,
  onNavigate,
  expanded,
  onToggle,
  showDivider,
}: {
  label: string
  items: MenuNode[]
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  expanded: boolean
  onToggle: () => void
  showDivider: boolean
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-1.5 text-muted-foreground hover:text-foreground transition-colors group"
      >
        {showDivider && <div className="h-px bg-border/50 group-hover:bg-border transition-colors" style={{ width: "8px" }} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 group-hover:text-foreground/60 transition-colors shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-border/50 group-hover:bg-border transition-colors" />
        {expanded ? (
          <ChevronUp className="h-2.5 w-2.5 shrink-0" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 shrink-0" />
        )}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 pb-0.5">
            {items.map((node) => (
              <SidebarItem
                key={node.id}
                label={node.label}
                icon={getIconForNode(node)}
                isActive={currentPage === (node.key as PageKey)}
                onClick={() => onNavigate(node.key as PageKey)}
                collapsed={false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({ currentPage, onNavigate, collapsed, onToggleSidebar }: SidebarProps) {
  const { user, logout } = useAuth()
  const [menuTree, setMenuTree] = useState<MenuNode[] | null>(null)
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!user?.rol) return
    let cancelled = false
    setMenusLoading(true)
    setMenusError(null)
    fetchMyMenus(user.rol)
      .then((data) => { if (!cancelled) setMenuTree(data) })
      .catch((e) => { if (!cancelled) setMenusError(e instanceof Error ? e.message : "Error al cargar menú") })
      .finally(() => { if (!cancelled) setMenusLoading(false) })
    return () => { cancelled = true }
  }, [user?.rol, retryCount])

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    justificaciones: true,
    gestion: true,
    configuracion: true,
  })

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const visibleSections = useMemo(() => {
    if (!menuTree) return []
    const leafMap = new Map(
      collectLeafNodes(menuTree)
        .filter((n) => n.key)
        .map((n) => [n.key!, n])
    )
    return SECTION_DEFS.map((def) => ({
      def,
      items: def.keys.filter((k) => leafMap.has(k)).map((k) => leafMap.get(k)!),
    })).filter(({ items }) => items.length > 0)
  }, [menuTree])
  const allLeaves = useMemo(() => {
    if (!menuTree) return []
    return collectLeafNodes(menuTree).filter((n) => n.key)
  }, [menuTree])
  const userInitial = user?.nombre?.charAt(0)?.toUpperCase() ?? "?"
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col bg-sidebar-bg-light text-foreground border-r border-border/80 transition-all duration-300 shadow-sm",
          collapsed ? "w-14" : "w-56"
        )}
        aria-label="Navegación principal"
      >
        <div className="flex flex-col items-center gap-2 border-b border-border/60 px-3 py-3.5">
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-semibold leading-tight text-foreground">
              <center></center>
            </span>
            {onToggleSidebar && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    aria-label={collapsed ? "Abrir menú" : "Cerrar menú"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{collapsed ? "Abrir menú" : "Cerrar menú"}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex w-full items-center justify-center rounded-md bg-white/10 p-1">
            <img
              src="/logo-20finanzas.png"
              alt="Finanzas"
              className="w-full h-14 object-contain"
            />
          </div>
          {!collapsed && (
            <span className="text-[10px] leading-tight text-muted-foreground">
              Dictaminación Técnica
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Menú">
          {menusLoading && (
            <p className="text-sm text-muted-foreground px-2.5 py-2">Cargando menú…</p>
          )}
          {!menusLoading && menusError && (
            <div className="flex flex-col gap-1.5 px-2.5 py-2">
              <p className="text-xs text-destructive">{menusError}</p>
              <button
                type="button"
                onClick={() => setRetryCount((n) => n + 1)}
                className="text-xs text-muted-foreground underline hover:text-foreground text-left"
              >
                Reintentar
              </button>
            </div>
          )}

          {!menusLoading && !menusError && menuTree && (
            collapsed ? (
              <div className="flex flex-col gap-px">
                {allLeaves.map((node) => (
                  <SidebarItem
                    key={node.id}
                    label={node.label}
                    icon={getIconForNode(node)}
                    isActive={currentPage === (node.key as PageKey)}
                    onClick={() => onNavigate(node.key as PageKey)}
                    collapsed
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col">
                {visibleSections.map(({ def, items }, index) => (
                  <SidebarSection
                    key={def.id}
                    label={def.label}
                    items={items}
                    currentPage={currentPage}
                    onNavigate={onNavigate}
                    expanded={expandedSections[def.id] !== false}
                    onToggle={() => toggleSection(def.id)}
                    showDivider={index > 0}
                  />
                ))}
              </div>
            )
          )}
        </nav>

        {!collapsed ? (
          <div className="border-t border-border/60 px-3 py-2.5">
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-dropdown text-destructive-foreground text-xs font-medium">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {user?.nombre ?? "Usuario"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {user?.rol ?? ""}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 flex-1 text-xs font-medium text-foreground hover:bg-foreground/5"
                onClick={() => onNavigate("perfil")}
                aria-label="Ir a Perfil"
              >
                <UserCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="ml-1">Perfil</span>
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 text-xs font-medium bg-sidebar-dropdown text-destructive-foreground hover:opacity-90"
                onClick={() => void logout()}
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="ml-1">Salir</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border/60 px-1.5 py-2 flex flex-col items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onNavigate("perfil")}
                  className="rounded p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                  aria-label="Perfil"
                >
                  <UserCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Perfil</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Salir</TooltipContent>
            </Tooltip>
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}
