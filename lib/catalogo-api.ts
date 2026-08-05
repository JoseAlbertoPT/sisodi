

export interface OrganoCentralizadoNode {
  id: string
  nombre: string
  orden: number
  tipo: string | null
  parent_id: string | null
  ua_clave_administrativa: string | null
  clave_reporte_plazas: string | null
  children: OrganoCentralizadoNode[]
}

export interface CategoriaParaestatalItem {
  id: number
  nombre: string
  orden: number
  organos: OrganoParaestatalItem[]
}

export interface OrganoParaestatalItem {
  id: number
  nombre: string
  orden: number
  categoria_id: number
  ua_clave_administrativa: string | null
  clave_reporte_plazas: string | null
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json()
}

function jsonBody(data: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }
}

export function fetchCentralizadaTree() {
  return api<OrganoCentralizadoNode[]>("/api/catalogo/centralizada")
}

export function createOrganoCentralizado(data: {
  nombre: string
  parentId?: string | null
  orden?: number
  tipo?: string | null
  ua_clave_administrativa?: string | null
  clave_reporte_plazas?: string | null
}) {
  return api<OrganoCentralizadoNode>("/api/catalogo/centralizada", {
    method: "POST",
    ...jsonBody(data),
  })
}

export function updateOrganoCentralizado(
  id: string,
  data: { nombre?: string; parentId?: string | null; orden?: number; tipo?: string | null; ua_clave_administrativa?: string | null; clave_reporte_plazas?: string | null }
) {
  return api<OrganoCentralizadoNode>(`/api/catalogo/centralizada/${id}`, {
    method: "PATCH",
    ...jsonBody(data),
  })
}

export function deleteOrganoCentralizado(id: string) {
  return api<{ ok: boolean }>(`/api/catalogo/centralizada/${id}`, {
    method: "DELETE",
  })
}

export function fetchCategoriasParaestatal() {
  return api<CategoriaParaestatalItem[]>("/api/catalogo/paraestatal/categorias")
}

export function createCategoriaParaestatal(data: { nombre: string; orden?: number }) {
  return api<CategoriaParaestatalItem>("/api/catalogo/paraestatal/categorias", {
    method: "POST",
    ...jsonBody(data),
  })
}

export function updateCategoriaParaestatal(id: number, data: { nombre?: string; orden?: number }) {
  return api<CategoriaParaestatalItem>(`/api/catalogo/paraestatal/categorias/${id}`, {
    method: "PATCH",
    ...jsonBody(data),
  })
}

export function deleteCategoriaParaestatal(id: number) {
  return api<{ ok: boolean }>(`/api/catalogo/paraestatal/categorias/${id}`, {
    method: "DELETE",
  })
}

export function fetchOrganosParaestatal(categoriaId?: number) {
  const qs = categoriaId ? `?categoriaId=${categoriaId}` : ""
  return api<OrganoParaestatalItem[]>(`/api/catalogo/paraestatal/organos${qs}`)
}

export function createOrganoParaestatal(data: {
  nombre: string
  categoriaId: number
  orden?: number
}) {
  return api<OrganoParaestatalItem>("/api/catalogo/paraestatal/organos", {
    method: "POST",
    ...jsonBody(data),
  })
}

export function updateOrganoParaestatal(
  id: number,
  data: { nombre?: string; categoriaId?: number; orden?: number }
) {
  return api<OrganoParaestatalItem>(`/api/catalogo/paraestatal/organos/${id}`, {
    method: "PATCH",
    ...jsonBody(data),
  })
}

export function deleteOrganoParaestatal(id: number) {
  return api<{ ok: boolean }>(`/api/catalogo/paraestatal/organos/${id}`, {
    method: "DELETE",
  })
}

export interface ImportRowCentralizada {
  secretaria: string
  ua: string
  clave?: string
}

export interface ImportCentralizadaResult {
  secretariasCreadas: number
  uasCreadas: number
  saltadas: { secretaria: string; ua: string; motivo: string }[]
}

export function importCentralizadaBulk(rows: ImportRowCentralizada[]) {
  return api<ImportCentralizadaResult>("/api/catalogo/centralizada/import", {
    method: "POST",
    ...jsonBody({ rows }),
  })
}

export interface ImportRowParaestatal {
  organismo: string
  area: string
}

export interface ImportParaestatalResult {
  organismosCreados: number
  areasCreadas: number
  saltadas: { organismo: string; area: string; motivo: string }[]
}

export function importParaestatalBulk(rows: ImportRowParaestatal[]) {
  return api<ImportParaestatalResult>("/api/catalogo/paraestatal/import", {
    method: "POST",
    ...jsonBody({ rows }),
  })
}
