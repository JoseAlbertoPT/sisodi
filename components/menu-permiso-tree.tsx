"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react"
import type { MenuNode } from "@/lib/permisos-api"

export const CATALOGO_MENU_KEY = "catalogo-justificaciones"
export const CATALOGO_ACCION_ADMINISTRACION = "administracion"
export const CATALOGO_ACCION_CONSULTA = "consulta"
// Debe reflejar lib/api-guard.ts:ROLES_ADMIN_CATALOGO — duplicado porque ese módulo importa
// Prisma y no puede usarse desde un componente cliente.
const ROLES_ADMIN_CATALOGO = ["Administrador", "Emisor", "Verificador", "Revisor"]

/**
 * Consulta y Administración de Catálogo son independientes entre sí (ver
 * lib/api-guard.ts:puedeAdministrarCatalogo/puedeConsultarCatalogo). Sin
 * override explícito para este usuario, se usa el default por rol
 * (Administración) o siempre-permitido (Consulta). Con override explícito
 * (acciones no vacío), es autoritativo para ambas: solo se ve lo marcado.
 */
export function catalogoIncluyeAdministracion(acciones: string[] | undefined, rolUsuario: string | undefined): boolean {
  const list = acciones ?? []
  if (list.length > 0) return list.includes(CATALOGO_ACCION_ADMINISTRACION)
  return rolUsuario ? ROLES_ADMIN_CATALOGO.includes(rolUsuario) : false
}

export function catalogoIncluyeConsulta(acciones: string[] | undefined): boolean {
  const list = acciones ?? []
  if (list.length > 0) return list.includes(CATALOGO_ACCION_CONSULTA)
  return true
}

export function countActiveChildren(nodes: MenuNode[], menuIdSet: Set<string>): { active: number; total: number } {
  let active = 0
  let total = 0
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        total++
        if (menuIdSet.has(child.id)) active++
        if (child.children) {
          const sub = countActiveChildren([child], menuIdSet)
          active += sub.active
          total += sub.total - 1
        }
      }
    } else {
      total++
      if (menuIdSet.has(node.id)) active++
    }
  }
  return { active, total }
}

export function toggleAllInSection(
  node: MenuNode,
  checked: boolean,
  onMenuToggle: (menuId: string, checked: boolean, key: string | null) => void,
) {
  onMenuToggle(node.id, checked, node.key)
  if (node.children) {
    for (const child of node.children) {
      toggleAllInSection(child, checked, onMenuToggle)
    }
  }
}

export function MenuPermisoTree({
  nodes,
  menuIds,
  onMenuToggle,
  level,
  menuActions,
  onCatalogoAccionChange,
  rolUsuario,
}: {
  nodes: MenuNode[]
  menuIds: string[]
  onMenuToggle: (menuId: string, checked: boolean, key: string | null) => void
  level: number
  menuActions?: Record<string, string[]>
  onCatalogoAccionChange?: (menuId: string, accion: "consulta" | "administracion", checked: boolean) => void
  rolUsuario?: string
}) {
  const menuIdSet = new Set(menuIds)
  const isTopLevel = level === 0

  return (
    <div className="space-y-3">
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0
        const showAsSection = isTopLevel && hasChildren

        if (showAsSection) {
          const counts = countActiveChildren([node], menuIdSet)
          return (
            <Collapsible key={node.id} defaultOpen className="group rounded-lg border border-border bg-card overflow-hidden shadow-sm">
              <CollapsibleTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full items-center gap-3 bg-muted/40 px-4 py-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      ;(e.currentTarget as HTMLElement).click()
                    }
                  }}
                >
                  <img src="/iconos2/addPlus.svg" alt="" width={16} height={16} className="shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-45" />
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={menuIdSet.has(node.id) || counts.active > 0}
                      onCheckedChange={(c) => {
                        if (!c) {
                          // Apagar: deshabilita la sección y todos sus hijos
                          toggleAllInSection(node, false, onMenuToggle)
                        } else {
                          // Encender: solo habilita la sección, los hijos se activan manualmente
                          onMenuToggle(node.id, true, node.key)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm font-medium text-card-foreground uppercase tracking-wide truncate">
                      {node.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={counts.active > 0 ? "default" : "outline"}
                      className="text-[10px] font-mono tabular-nums"
                    >
                      {counts.active}/{counts.total}
                    </Badge>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border">
                  <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 border-b border-border/50">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => toggleAllInSection(node, true, onMenuToggle)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Activar todo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => toggleAllInSection(node, false, onMenuToggle)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Desactivar todo
                    </Button>
                  </div>

                  <div className="px-4 py-3">
                    {hasChildren && (
                      <div className="space-y-1">
                        {node.children!.map((child) => (
                          <MenuPermisoRow
                            key={child.id}
                            node={child}
                            menuIds={menuIds}
                            onMenuToggle={onMenuToggle}
                            depth={0}
                            menuActions={menuActions}
                            onCatalogoAccionChange={onCatalogoAccionChange}
                            rolUsuario={rolUsuario}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        }

        return (
          <div key={node.id}>
            <MenuPermisoRow
              node={node}
              menuIds={menuIds}
              onMenuToggle={onMenuToggle}
              depth={level}
              menuActions={menuActions}
              onCatalogoAccionChange={onCatalogoAccionChange}
              rolUsuario={rolUsuario}
            />
          </div>
        )
      })}
    </div>
  )
}

function MenuPermisoRow({
  node,
  menuIds,
  onMenuToggle,
  depth,
  menuActions,
  onCatalogoAccionChange,
  rolUsuario,
}: {
  node: MenuNode
  menuIds: string[]
  onMenuToggle: (menuId: string, checked: boolean, key: string | null) => void
  depth: number
  menuActions?: Record<string, string[]>
  onCatalogoAccionChange?: (menuId: string, accion: "consulta" | "administracion", checked: boolean) => void
  rolUsuario?: string
}) {
  const menuIdSet = new Set(menuIds)
  const isChecked = menuIdSet.has(node.id)
  const hasChildren = node.children && node.children.length > 0
  const esCatalogo = node.key === CATALOGO_MENU_KEY
  const incluyeAdministracion = catalogoIncluyeAdministracion(menuActions?.[node.id], rolUsuario)
  const incluyeConsulta = catalogoIncluyeConsulta(menuActions?.[node.id])

  return (
    <div
      className={`
        rounded-lg transition-all
        ${isChecked
          ? "bg-primary/[0.03] border border-primary/10"
          : "bg-transparent border border-transparent hover:bg-muted/30"
        }
        ${depth > 0 ? "ml-4" : ""}
      `}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Switch
          id={`menu-${node.id}`}
          checked={isChecked}
          onCheckedChange={(c) => onMenuToggle(node.id, c, node.key)}
          className="shrink-0"
        />
        <label
          htmlFor={`menu-${node.id}`}
          className={`text-sm font-light cursor-pointer flex-1 ${isChecked ? "text-[var(--color-core-piedra-20)]" : "text-muted-foreground"}`}
        >
          {node.label}
        </label>
        {esCatalogo && isChecked && onCatalogoAccionChange && (
          <div className="flex items-center gap-3 shrink-0" role="group" aria-label="Nivel de acceso a Catálogo">
            <button
              type="button"
              role="checkbox"
              aria-checked={incluyeConsulta}
              className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors ${
                incluyeConsulta ? "text-content-high font-medium" : "text-muted-foreground hover:text-content-high"
              }`}
              onClick={() => onCatalogoAccionChange(node.id, "consulta", !incluyeConsulta)}
            >
              {incluyeConsulta && (
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "9999px", backgroundColor: "#10b981", flexShrink: 0 }} />
              )}
              Consulta
            </button>
            <button
              type="button"
              role="checkbox"
              aria-checked={incluyeAdministracion}
              className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors ${
                incluyeAdministracion ? "text-content-high font-medium" : "text-muted-foreground hover:text-content-high"
              }`}
              onClick={() => onCatalogoAccionChange(node.id, "administracion", !incluyeAdministracion)}
            >
              {incluyeAdministracion && (
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "9999px", backgroundColor: "#10b981", flexShrink: 0 }} />
              )}
              Administración
            </button>
          </div>
        )}
      </div>

      {hasChildren && (
        <div className="space-y-1 pb-2">
          {node.children!.map((child) => (
            <MenuPermisoRow
              key={child.id}
              node={child}
              menuIds={menuIds}
              onMenuToggle={onMenuToggle}
              depth={depth + 1}
              menuActions={menuActions}
              onCatalogoAccionChange={onCatalogoAccionChange}
              rolUsuario={rolUsuario}
            />
          ))}
        </div>
      )}
    </div>
  )
}
