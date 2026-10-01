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
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
              "flex h-11 w-11 mx-auto items-center justify-center rounded-2xl text-content-high transition-colors",
              isActive ? "bg-bg-base shadow-sm" : "hover:bg-reactive-surface-hover"
            )}
          >
            <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
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
      title={label}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-content-high transition-colors",
        isActive ? "bg-bg-base shadow-sm" : "hover:bg-reactive-surface-hover"
      )}
    >
      <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span className="flex-1 truncate font-sans text-[14px] font-normal leading-[120%]">{label}</span>
    </button>
  )
}

function getInitials(nombre: string | undefined): string {
  if (!nombre) return ""
  const palabras = nombre
    .replace(/^(ing|lic|dr|dra|mtro|mtra)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
  return palabras.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
        if (JSON.stringify(data) !== JSON.stringify(menuTreeRef.current)) setMenuTree(data)
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

  // Cada nodo raíz del menú (Justificaciones, Gestión DGDO, Configuración…) es una sección
  // separada por una línea, como en el diseño de Figma.
  const sections = useMemo(() => {
    if (!menuTree) return []
    return menuTree
      .map((root) => ({
        id: root.id,
        leaves: collectLeafNodes([root]).filter(
          (n) => n.key && n.route !== null && n.key !== "revision-do" && n.key !== "progreso-firmado"
        ),
      }))
      .filter((s) => s.leaves.length > 0)
  }, [menuTree])
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-full flex-col bg-bg-surface-low rounded-2xl transition-all duration-300 overflow-hidden",
          "fixed inset-y-1 left-1 z-40 w-[calc(100%-0.5rem)] max-w-[304px] shadow-lg",
          "md:relative md:inset-auto md:translate-x-0 md:shadow-none md:flex-shrink-0 md:max-w-none",
          collapsed ? "-translate-x-[calc(100%+8px)] md:-translate-x-0 md:w-[93px]" : "translate-x-0 md:w-[304px]"
        )}
        aria-label="Navegación principal"
      >
        {/* Header */}
        <div
          className={cn(
            "flex shrink-0 items-center",
            collapsed ? "flex-col gap-3 px-0 pt-6 pb-4" : "h-[100px] gap-3 px-6 pt-6 pb-4"
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border-md bg-bg-base">
            <img src="/sidebar/isotipo.svg" alt="Gobierno de Morelos" width={24} height={25.309} />
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 flex-col gap-1 font-sans leading-[120%]">
              <p className="truncate text-[16px] font-bold tracking-[0.16px] text-content-high">SEDITEF</p>
              <p className="truncate text-[12px] font-light tracking-[0.12px] text-content-low">Portal Administrador</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            className="flex shrink-0 items-center justify-center rounded-lg bg-bg-surface-md p-2 transition-colors hover:bg-border-low"
          >
            <img
              src="/sidebar/icon-colapsar.svg"
              alt=""
              width={20}
              height={20}
              className={cn("transition-transform", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/* Main */}
        <div className={cn("flex min-h-0 flex-1 flex-col", collapsed ? "px-3" : "px-6")}>
          <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-2" aria-label="Menú">
            {menusLoading && (
              <p className="text-xs text-content-low px-4 py-2">Cargando…</p>
            )}
            {!menusLoading && menusError && (
              <div className="flex flex-col gap-1 px-4 py-2">
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

            {!menusLoading && !menusError && menuTree && sections.map((section) => (
              <div key={section.id} className="flex flex-col gap-1 py-2">
                {section.leaves.map((node) => (
                  <SidebarItem
                    key={node.id}
                    label={node.label}
                    icon={getIconForNode(node)}
                    isActive={currentPage === (node.key as PageKey)}
                    onClick={() => onNavigate(node.key as PageKey)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer: usuario; al hacer clic abre el menú con "Cerrar sesión" */}
        <div className={cn("shrink-0 py-4", collapsed ? "px-3" : "px-6")}>
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Opciones de usuario"
                className={cn(
                  "flex items-center rounded-2xl text-left transition-colors",
                  collapsed ? "mx-auto h-11 w-11 justify-center" : "w-full gap-4 px-4 py-3",
                  userMenuOpen ? "bg-bg-surface-md" : "hover:bg-reactive-surface-hover"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-primary-low">
                  <span className="font-sans text-[14px] font-light leading-[120%] tracking-[0.14px] text-accent-on-primary-low">
                    {getInitials(user?.nombre)}
                  </span>
                </div>
                {!collapsed && (
                  <div className="flex min-w-0 flex-1 flex-col font-sans">
                    <p className="truncate text-[14px] font-normal leading-[120%] text-content-high" title={user?.nombre}>
                      {user?.nombre}
                    </p>
                    <p className="truncate text-[12px] font-light leading-[140%] tracking-[0.12px] text-content-low">
                      {user?.rol}
                    </p>
                  </div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side={collapsed ? "right" : "top"}
              align="start"
              sideOffset={8}
              className="w-[var(--radix-popover-trigger-width)] min-w-[200px] rounded-2xl border-border-low bg-bg-base p-1 shadow-md"
            >
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); setConfirmLogout(true) }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-content-high transition-colors hover:bg-reactive-surface-hover"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0 text-content-low" />
                <span className="font-sans text-[14px] font-normal leading-[120%]">Cerrar sesión</span>
              </button>
            </PopoverContent>
          </Popover>
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
