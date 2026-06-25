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
  LogOut,
} from "lucide-react"
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
  | "progreso-firmado"
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
}

function getIconForNode(node: MenuNode): React.ReactNode {
  const Icon = (node.icon && ICON_MAP[node.icon]) || MenuIcon
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
              "flex w-full justify-center rounded-lg p-2.5 transition-colors",
              isActive
                ? "bg-white text-[#2D3B2D] shadow-sm"
                : "text-[#5a6c5a] hover:bg-white/60 hover:text-[#2D3B2D]"
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
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors text-left",
        isActive
          ? "bg-white text-[#2D3B2D] font-semibold shadow-sm"
          : "text-[#4a5c4a] font-normal hover:bg-white/60 hover:text-[#2D3B2D]"
      )}
    >
      <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
      <span className="leading-tight truncate">{label}</span>
    </button>
  )
}

export function AppSidebar({ currentPage, onNavigate, collapsed, onMenuReady }: SidebarProps) {
  const { logout, user } = useAuth()
  const [menuTree, setMenuTree] = useState<MenuNode[] | null>(null)
  const [menusLoading, setMenusLoading] = useState(true)
  const [menusError, setMenusError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!user?.rol) return
    let cancelled = false
    setMenusLoading(true)
    setMenusError(null)
    fetchMyMenus(user.rol, user.id)
      .then((data) => { if (!cancelled) setMenuTree(data) })
      .catch((e) => { if (!cancelled) setMenusError(e instanceof Error ? e.message : "Error al cargar menú") })
      .finally(() => { if (!cancelled) setMenusLoading(false) })
    return () => { cancelled = true }
  }, [user?.rol, user?.id, retryCount])

  const INTERNAL_PAGES = useMemo(() => new Set(["revision-do", "progreso-firmado", "perfil", "nueva-solicitud"]), [])
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
      .filter((n) => n.key && n.route !== null && n.key !== "revision-do")
      .sort((a, b) => a.orden - b.orden)
    return { allLeaves: leaves }
  }, [menuTree])

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-[#E0DED8] transition-all duration-300 overflow-hidden",
          collapsed ? "w-[64px]" : "w-[220px]"
        )}
        style={{ backgroundColor: "#F5F5F0" }}
        aria-label="Navegación principal"
      >
        <div
          className={cn(
            "flex shrink-0 items-center border-b border-[#E0DED8]",
            collapsed ? "h-[64px] justify-center px-2" : "h-[64px] gap-2 px-3"
          )}
        >
          {collapsed ? (
            <img
              src="/LOGO_MORELOS_V1.png"
              alt="Morelos"
              className="h-8 w-8 object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 min-w-0 w-full">
              <img
                src="/LOGO_MORELOS_V1.png"
                alt="Morelos"
                className="h-9 w-9 object-contain shrink-0"
              />
              <img
                src="/logo-20finanzas.png"
                alt="Finanzas"
                className="h-9 flex-1 object-contain object-left min-w-0"
              />
            </div>
          )}
        </div>


        <div
          className={cn(
            "shrink-0 border-b border-[#E0DED8]",
            collapsed ? "flex justify-center px-2 py-2.5" : "px-4 py-2.5"
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block h-6 w-6 rounded-full bg-[#2D3B2D]/10 text-center text-[9px] font-bold leading-6 text-[#2D3B2D] cursor-default select-none">
                  {(user?.rfc ?? "?").slice(0, 2).toUpperCase()}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">{user?.rfc ?? ""}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex flex-col gap-0">
              <span className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wide leading-none mb-0.5">
                RFC
              </span>
              <span className="text-[12px] font-semibold text-[#2D3B2D] leading-tight truncate">
                {user?.rfc ?? "—"}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5" aria-label="Menú">
          {menusLoading && (
            <p className="text-xs text-[#9CA3AF] px-3 py-2">Cargando…</p>
          )}
          {!menusLoading && menusError && (
            <div className="flex flex-col gap-1 px-3 py-2">
              <p className="text-xs text-red-500">{menusError}</p>
              <button
                type="button"
                onClick={() => setRetryCount((n) => n + 1)}
                className="text-xs text-[#6B7280] underline hover:text-[#2D3B2D] text-left"
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

        <div className="shrink-0 border-t border-[#E0DED8] px-2 py-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full justify-center rounded-lg p-2.5 text-[#9CA3AF] hover:bg-white/60 hover:text-red-500 transition-colors"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar sesión</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-[#9CA3AF] hover:bg-white/60 hover:text-red-500 transition-colors"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span className="leading-tight">Cerrar sesión</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
