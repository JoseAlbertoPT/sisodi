"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react"
import type { MenuNode } from "@/lib/permisos-api"

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
  onMenuToggle: (menuId: string, checked: boolean) => void,
  onActionToggle: (menuId: string, code: string, checked: boolean) => void,
) {
  onMenuToggle(node.id, checked)
  if (node.acciones) {
    for (const a of node.acciones) {
      onActionToggle(node.id, a.code, checked)
    }
  }
  if (node.children) {
    for (const child of node.children) {
      toggleAllInSection(child, checked, onMenuToggle, onActionToggle)
    }
  }
}

export function MenuPermisoTree({
  nodes,
  menuIds,
  menuActions,
  onMenuToggle,
  onActionToggle,
  level,
}: {
  nodes: MenuNode[]
  menuIds: string[]
  menuActions: Record<string, string[]>
  onMenuToggle: (menuId: string, checked: boolean) => void
  onActionToggle: (menuId: string, code: string, checked: boolean) => void
  level: number
}) {
  const menuIdSet = new Set(menuIds)
  const isTopLevel = level === 0

  return (
    <div className="space-y-3">
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0
        const hasAcciones = node.acciones && node.acciones.length > 0
        const isChecked = menuIdSet.has(node.id)
        const showAsSection = isTopLevel && (hasChildren || hasAcciones)

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
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:rotate-[-90deg]" />
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={isChecked}
                      onCheckedChange={(c) => onMenuToggle(node.id, c)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm font-semibold text-card-foreground uppercase tracking-wide truncate">
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
                    <span className="text-[11px] text-muted-foreground mr-1">Acciones rápidas:</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-primary hover:text-primary"
                      onClick={() => toggleAllInSection(node, true, onMenuToggle, onActionToggle)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Activar todo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() => toggleAllInSection(node, false, onMenuToggle, onActionToggle)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Desactivar todo
                    </Button>
                  </div>

                  <div className="px-4 py-3">
                    {hasAcciones && isChecked && (
                      <div className="mb-3">
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                          Acciones de sección
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {node.acciones!.map((a) => {
                            const active = (menuActions[node.id] ?? []).includes(a.code)
                            return (
                              <button
                                key={a.code}
                                type="button"
                                onClick={() => onActionToggle(node.id, a.code, !active)}
                                className={`
                                  inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all cursor-pointer
                                  ${active
                                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/30"
                                  }
                                `}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} />
                                {a.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {hasChildren && (
                      <div className="space-y-1">
                        {node.children!.map((child) => (
                          <MenuPermisoRow
                            key={child.id}
                            node={child}
                            menuIds={menuIds}
                            menuActions={menuActions}
                            onMenuToggle={onMenuToggle}
                            onActionToggle={onActionToggle}
                            depth={0}
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
              menuActions={menuActions}
              onMenuToggle={onMenuToggle}
              onActionToggle={onActionToggle}
              depth={level}
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
  menuActions,
  onMenuToggle,
  onActionToggle,
  depth,
}: {
  node: MenuNode
  menuIds: string[]
  menuActions: Record<string, string[]>
  onMenuToggle: (menuId: string, checked: boolean) => void
  onActionToggle: (menuId: string, code: string, checked: boolean) => void
  depth: number
}) {
  const menuIdSet = new Set(menuIds)
  const isChecked = menuIdSet.has(node.id)
  const hasAcciones = node.acciones && node.acciones.length > 0
  const hasChildren = node.children && node.children.length > 0
  const activeActions = menuActions[node.id] ?? []

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
          onCheckedChange={(c) => onMenuToggle(node.id, c)}
          className="shrink-0"
        />
        <label
          htmlFor={`menu-${node.id}`}
          className={`text-sm font-medium cursor-pointer flex-1 ${isChecked ? "text-card-foreground" : "text-muted-foreground"}`}
        >
          {node.label}
        </label>
        {hasAcciones && isChecked && (
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
            {activeActions.length}/{node.acciones!.length}
          </Badge>
        )}
      </div>

      {hasAcciones && isChecked && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pt-0 ml-11">
          {node.acciones!.map((a) => {
            const active = activeActions.includes(a.code)
            return (
              <button
                key={a.code}
                type="button"
                onClick={() => onActionToggle(node.id, a.code, !active)}
                className={`
                  inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer
                  ${active
                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                  }
                `}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} />
                {a.label}
              </button>
            )
          })}
        </div>
      )}

      {hasChildren && (
        <div className="space-y-1 pb-2">
          {node.children!.map((child) => (
            <MenuPermisoRow
              key={child.id}
              node={child}
              menuIds={menuIds}
              menuActions={menuActions}
              onMenuToggle={onMenuToggle}
              onActionToggle={onActionToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
