"use client"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { fetchMyMenus, type MenuNode } from "@/lib/permisos-api"
import { useState, useEffect, useCallback } from "react"
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
  Shield,
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

function nodeContainsRoute(nodes: MenuNode[] | undefined, route: string): boolean {
  if (!nodes) return false
  for (const n of nodes) {
    if (n.key === route) return true
    if (nodeContainsRoute(n.children, route)) return true
  }
  return false
}

interface SidebarNavTreeProps {
  nodes: MenuNode[]
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  collapsed: boolean
  expandedGroups: Record<string, boolean>
  toggleGroup: (id: string) => void
  isGroupExpanded: (id: string) => boolean
}

function SidebarNavTree({
  nodes,
  currentPage,
  onNavigate,
  collapsed,
  expandedGroups,
  toggleGroup,
  isGroupExpanded,
}: SidebarNavTreeProps) {
  
  if (collapsed) {
    const leaves = collectLeafNodes(nodes)
    return (
      <div className="flex flex-col gap-px">
        {leaves.map((node) => {
          const key = node.key as PageKey
          return (
            <Tooltip key={node.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={cn(
                    "flex w-full justify-center rounded p-2 text-black transition-colors",
                    currentPage === key
                      ? "shadow-md shadow-black/10"
                      : "hover:bg-foreground/5 hover:text-black"
                  )}
                  aria-label={node.label}
                >
                  <span className="[&>svg]:h-4 [&>svg]:w-4">{getIconForNode(node)}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{node.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    )
  }

  
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0
        const expanded = isGroupExpanded(node.id)
        const isActive =
          node.key === currentPage ||
          (hasChildren && nodeContainsRoute(node.children, currentPage))

        
        if (node.key && !hasChildren) {
          const key = node.key as PageKey
          return (
            <Tooltip key={node.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors border-l-2 border-transparent text-black",
                    currentPage === key
                      ? "shadow-md shadow-black/10 border-l-sidebar-dropdown bg-transparent"
                      : "hover:bg-foreground/5"
                  )}
                >
                  <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4 opacity-90">
                    {getIconForNode(node)}
                  </span>
                  <span className="truncate">{node.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{node.label}</TooltipContent>
            </Tooltip>
          )
        }

        
        if (hasChildren) {
          const childLeaves = node.children!.filter((c) => c.key)
          const singleItem = childLeaves.length === 1 && node.children!.length === 1

          if (singleItem) {
            
            const child = childLeaves[0]!
            const childKey = child.key as PageKey
            return (
              <Tooltip key={node.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onNavigate(childKey)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors border-l-2 border-transparent text-black",
                      currentPage === childKey
                        ? "shadow-md shadow-black/10 border-l-sidebar-dropdown bg-transparent"
                        : "hover:bg-foreground/5"
                    )}
                  >
                    <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4 opacity-90">
                      {getIconForNode(child)}
                    </span>
                    <span className="truncate">{child.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{child.label}</TooltipContent>
              </Tooltip>
            )
          }

          
          return (
            <div key={node.id}>
              <button
                type="button"
                onClick={() => toggleGroup(node.id)}
                className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-[13px] font-medium transition-colors text-black hover:bg-foreground/5"
                aria-expanded={expanded}
                aria-controls={`nav-group-${node.id}`}
                id={`nav-group-btn-${node.id}`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4 opacity-90">
                    {getIconForNode(node)}
                  </span>
                  <span className="truncate">{node.label}</span>
                </span>
                <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 opacity-80 text-muted-foreground">
                  {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                </span>
              </button>
              <div
                id={`nav-group-${node.id}`}
                role="region"
                aria-labelledby={`nav-group-btn-${node.id}`}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="border-l-2 border-sidebar-dropdown pl-3 ml-1 mt-0.5">
                    <SidebarNavTree
                      nodes={node.children!}
                      currentPage={currentPage}
                      onNavigate={onNavigate}
                      collapsed={false}
                      expandedGroups={expandedGroups}
                      toggleGroup={toggleGroup}
                      isGroupExpanded={isGroupExpanded}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        }

        return null
      })}
    </>
  )
}

export function AppSidebar({ currentPage, onNavigate, collapsed, onToggleSidebar }: SidebarProps) {
  const { user, logout } = useAuth()
  const [menuTree, setMenuTree] = useState<MenuNode[] | null>(null)
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!user?.rol) return
    let cancelled = false
    setMenusLoading(true)
    setMenusError(null)
    fetchMyMenus(user.rol)
      .then((data) => {
        if (!cancelled) {
          setMenuTree(data)
          const initial: Record<string, boolean> = {}
          data.forEach((n) => { initial[n.id] = true })
          setExpandedGroups((prev) => ({ ...initial, ...prev }))
        }
      })
      .catch((e) => {
        if (!cancelled) setMenusError(e instanceof Error ? e.message : "Error al cargar menú")
      })
      .finally(() => {
        if (!cancelled) setMenusLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.rol])

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const isGroupExpanded = useCallback(
    (id: string) => expandedGroups[id] !== false,
    [expandedGroups]
  )

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
        {}
        <div className="flex flex-col items-center gap-2 border-b border-border/60 px-3 py-3.5">
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-semibold leading-tight text-foreground">
              <center>SDTF</center>
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

        {}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Menú">
          <div className="flex flex-col gap-1.5">
            {menusLoading && (
              <p className="text-sm text-muted-foreground px-2.5 py-2">Cargando menú…</p>
            )}
            {!menusLoading && menusError && (
              <p className="text-sm text-destructive px-2.5 py-2">{menusError}</p>
            )}
            {!menusLoading && !menusError && menuTree && menuTree.length > 0 && (
              <SidebarNavTree
                nodes={menuTree}
                currentPage={currentPage}
                onNavigate={onNavigate}
                collapsed={collapsed}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
                isGroupExpanded={isGroupExpanded}
              />
            )}

          </div>
        </nav>

        {}
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
