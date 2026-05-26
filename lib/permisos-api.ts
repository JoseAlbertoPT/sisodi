export interface MenuNode {
  id: string
  key: string | null
  label: string
  icon: string | null
  route: string | null
  orden: number
  children?: MenuNode[]
  acciones?: { code: string; label: string }[]
}

export interface PermisosUser {
  menuIds: string[]
  menuActions: Record<string, string[]>
}

export async function fetchMyMenus(rolNombre: string, userId?: string): Promise<MenuNode[]> {
  const url = `/api/menus?rol=${encodeURIComponent(rolNombre)}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`
  const res = await fetch(url)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Error al cargar menús (${res.status})`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchMenusTree(): Promise<MenuNode[]> {
  const res = await fetch("/api/menus/tree")
  if (!res.ok) throw new Error("Error al cargar árbol de menús")
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchPermisosUser(userId: string): Promise<PermisosUser> {
  const res = await fetch(`/api/permisos/${userId}`)
  if (!res.ok) throw new Error("Error al cargar permisos del usuario")
  return res.json()
}

export async function updatePermisosUser(userId: string, dto: PermisosUser): Promise<PermisosUser> {
  const res = await fetch(`/api/permisos/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  })
  if (!res.ok) throw new Error("Error al guardar permisos")
  return res.json()
}
