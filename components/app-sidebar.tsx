"use client"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { fetchMyMenus, type MenuNode } from "@/lib/permisos-api"
import { useRealtime } from "@/hooks/use-realtime"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
  Building2,
  BookOpen,
  ListChecks,
  Search,
  FileOutput,
  Menu as MenuIcon,
  LogOut,
  Info,
  X,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useSidebar } from "@/context/sidebar-context"

export type PageKey =
  | "dashboard"
  | "catalogo-justificaciones"
  | "nueva-solicitud"
  | "mis-solicitudes"
  | "validacion-uefa"
  | "bandeja-filtro1"
  | "bandeja-filtro2"
  | "bandeja-filtro3"
  | "progreso-firmado"
  | "revision-do"
  | "dictamenes"
  | "calendario"
  | "usuarios"
  | "entidades"
  | "configuracion"
  | "dependencia"
  | "dependencias"
  | "perfil"
  | "acerca-de"

interface SidebarProps {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  collapsed: boolean
  onMenuReady?: (ready: boolean) => void
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
  Building2,
  BookOpen,
}

const KEY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dependencias:      Building2,
  dependencia:       Building2,
  entidades:         Building2,
  "bandeja-filtro1": Search,
  "bandeja-filtro2": ListChecks,
  "bandeja-filtro3": FileOutput,
}

function getIconForNode(node: MenuNode): React.ReactNode {
  const Icon = (node.key && KEY_ICON_MAP[node.key]) || (node.icon && ICON_MAP[node.icon]) || MenuIcon
  return <Icon className="h-[18px] w-[18px]" />
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
    label: "Gestión DGDO",
    keys: ["bandeja-filtro1", "bandeja-filtro2", "bandeja-filtro3", "dictamenes"] as PageKey[],
  },
  {
    id: "administracion",
    label: "Administración",
    keys: ["calendario", "usuarios"] as PageKey[],
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
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              "flex w-9 h-9 mx-auto justify-center items-center rounded-xl transition-colors",
              isActive
                ? "bg-bg-base text-content-high shadow-sm"
                : "text-content-low hover:bg-reactive-surface-hover"
            )}
          >
            <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
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
      className={cn(
        "flex w-full items-center gap-6 rounded-xl px-3 py-2.5 transition-colors text-left",
        isActive
          ? "bg-bg-base text-content-high shadow-sm"
          : "text-content-low hover:bg-reactive-surface-hover"
      )}
    >
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      <span className="flex-1 truncate font-sans text-[14px] font-normal leading-[120%]">{label}</span>
    </button>
  )
}

export function AppSidebar({ currentPage, onNavigate, collapsed, onMenuReady }: SidebarProps) {
  const { logout, user } = useAuth()
  const { toggle } = useSidebar()
  const [menuTree, setMenuTree] = useState<MenuNode[] | null>(null)
  const menuTreeRef = useRef<MenuNode[] | null>(null)
  useEffect(() => { menuTreeRef.current = menuTree }, [menuTree])
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [confirmLogout, setConfirmLogout] = useState(false)

  useRealtime(["permisos"], () => setRetryCount((n) => n + 1))


  useEffect(() => {
    if (!user?.rol) return
    let cancelled = false
    const esCargaInicial = menuTreeRef.current === null
    if (esCargaInicial) setMenusLoading(true)
    setMenusError(null)
    fetchMyMenus(user.rol, user.id)
      .then((data) => {
        if (cancelled) return
        if (JSON.stringify(data) !== JSON.stringify(menuTreeRef.current11)) setMenuTree(data)
      })
      .catch((e) => { if (!cancelled) setMenusError(e instanceof Error ? e.message : "Error al cargar menú") })
      .finally(() => { if (!cancelled && esCargaInicial) setMenusLoading(false) })
    return () => { cancelled = true }
  }, [user?.rol, user?.id, retryCount])

  const INTERNAL_PAGES = useMemo(() => new Set(["revision-do", "progreso-firmado", "perfil", "nueva-solicitud", "acerca-de"]), [])
  useEffect(() => {
    if (menusLoading || !menuTree) return
    const availableKeys = new Set(collectLeafNodes(menuTree).filter((n) => n.key && n.route !== null).map((n) => n.key!))
    if (!INTERNAL_PAGES.has(currentPage) && !availableKeys.has(currentPage)) {
      const firstKey = SECTION_DEFS.flatMap((s) => s.keys).find((k) => availableKeys.has(k))
      if (firstKey) {
        onNavigate(firstKey)
        return
      }
    }
    onMenuReady?.(true)
  }, [menuTree, menusLoading, currentPage, onNavigate, INTERNAL_PAGES, onMenuReady])

  const { allLeaves } = useMemo(() => {
    if (!menuTree) return { allLeaves: [] }
    const leaves = collectLeafNodes(menuTree)
      .filter((n) => n.key && n.route !== null && n.key !== "revision-do" && n.key !== "progreso-firmado")

    return { allLeaves: leaves }
  }, [menuTree])
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-full flex-col bg-bg-surface-low rounded-xl transition-all duration-300 overflow-hidden",
          "fixed inset-y-1 left-1 z-40 w-[calc(100%-0.5rem)] max-w-[280px] shadow-lg",
          "md:relative md:inset-auto md:translate-x-0 md:shadow-none md:flex-shrink-0 md:max-w-none",
          collapsed ? "-translate-x-[calc(100%+8px)] md:-translate-x-0 md:w-[93px]" : "translate-x-0 md:w-[280px]"
        )}
        aria-label="Navegación principal"
      >
        <button
          type="button"
          onClick={toggle}
          aria-label="Cerrar menú"
          className="md:hidden absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-content-low hover:bg-reactive-surface-hover transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center p-3 pb-4 gap-2",
            collapsed ? "px-0 py-3" : ""
          )}
        >
          {collapsed ? (
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-bg-surface-md flex-shrink-0">
              <img src="/logo-quetzal-icono.svg" alt="Quetzal" style={{ width: 36, height: 36, objectFit: "contain" }} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-1">
              <img src="/logo-quetzal-icono.svg" alt="Quetzal" style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }} />
              <img src="/finanzas-logo-cortado.svg" alt="Finanzas" style={{ width: 130, height: 45, objectFit: "contain", objectPosition: "left" }} />
            </div>
          )}
        </div>

        {collapsed ? (
          <div className="mb-2 flex justify-center">
            <div className="w-12 border-t border-border-low" />
          </div>
        ) : (
          <div className="mb-2 border-t border-border-low" />
        )}


        <nav className="flex flex-1 flex-col overflow-y-auto px-2 pt-1 pb-2 gap-1" aria-label="Menú">
          {menusLoading && (
            <p className="text-xs text-content-low px-3 py-2">Cargando…</p>
          )}
          {!menusLoading && menusError && (
            <div className="flex flex-col gap-1 px-3 py-2">
              <p className="text-xs text-red-500">{menusError}</p>
              <button
                type="button"
                onClick={() => setRetryCount((n) => n + 1)}
                className="text-xs text-content-low underline hover:text-content-high text-left"
              >
                Reintentar
              </button>
            </div>
          )}

          {!menusLoading && !menusError && menuTree && (
            <>
              {allLeaves.map((node) => (
                <SidebarItem
                  key={node.id}
                  label={node.label}
                  icon={getIconForNode(node)}
                  isActive={currentPage === (node.key as PageKey)}
                  onClick={() => onNavigate(node.key as PageKey)}
                  collapsed={collapsed}
                />
              ))}
            </>
          )}
        </nav>

        <div className="shrink-0 border-t border-border-low px-2 py-2 flex flex-col gap-1">
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onNavigate("acerca-de")}
                    className={cn(
                      "flex w-9 h-9 mx-auto justify-center items-center rounded-xl transition-colors",
                      currentPage === "acerca-de"
                        ? "bg-bg-base text-content-high shadow-sm"
                        : "text-content-low hover:bg-reactive-surface-hover"
                    )}
                    aria-label="Acerca de"
                  >
                    <Info className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Acerca de</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                    className="flex w-9 h-9 mx-auto items-center justify-center rounded-xl text-content-low hover:bg-reactive-surface-hover transition-colors"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Cerrar sesión</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate("acerca-de")}
                className={cn(
                  "flex w-full items-center gap-6 rounded-xl px-3 py-2.5 transition-colors text-left font-sans text-[14px] font-normal leading-[120%]",
                  currentPage === "acerca-de"
                    ? "bg-bg-base text-content-high shadow-sm"
                    : "text-content-low hover:bg-reactive-surface-hover"
                )}
              >
                <Info className="h-[18px] w-[18px] shrink-0" />
                <span>Acerca de</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex w-full items-center gap-6 px-3 py-2.5 rounded-xl text-content-low hover:bg-reactive-surface-hover transition-colors font-sans text-[14px] font-normal leading-[120%]"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
                <span>Cerrar sesión</span>
              </button>
            </>
          )}
        </div>
      </aside>
      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); void logout() }}
        title="¿Cerrar sesión?"
        description="Se cerrará tu sesión actual y volverás a la pantalla de inicio."
        confirmLabel="Sí, cerrar sesión"
        variant="eliminar"
      />
    </TooltipProvider>
  )
}
