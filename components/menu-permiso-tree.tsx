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
) {
  onMenuToggle(node.id, checked)
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
}: {
  nodes: MenuNode[]
  menuIds: string[]
  onMenuToggle: (menuId: string, checked: boolean) => void
  level: number
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
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:rotate-[-90deg]" />
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Switch
                      checked={menuIdSet.has(node.id)}
                      onCheckedChange={(c) => {
                        if (!c) {
                          // Apagar: deshabilita la sección y todos sus hijos
                          toggleAllInSection(node, false, onMenuToggle)
                        } else {
                          // Encender: solo habilita la sección, los hijos se activan manualmente
                          onMenuToggle(node.id, true)
                        }
                      }}
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
                      onClick={() => toggleAllInSection(node, true, onMenuToggle)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Activar todo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
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
}: {
  node: MenuNode
  menuIds: string[]
  onMenuToggle: (menuId: string, checked: boolean) => void
  depth: number
}) {
  const menuIdSet = new Set(menuIds)
  const isChecked = menuIdSet.has(node.id)
  const hasChildren = node.children && node.children.length > 0

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
            />
          ))}
        </div>
      )}
    </div>
  )
}
