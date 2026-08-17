"use client"

import { useState, useCallback, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSpreadsheet, Upload, Loader2, Trash2, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { FileDropZone } from "@/components/ui/file-drop-zone"
import { PageLayout } from "@/components/page-layout"
import { CatalogoCentralizadaTab } from "@/components/catalogo-centralizada-tab"
import { CatalogoParaestatalTab } from "@/components/catalogo-paraestatal-tab"
import { useHistoricoStore } from "@/lib/historico-store"
import { fetchCategoriasParaestatal } from "@/lib/catalogo-api"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function HistoricoTab() {
  const { historicos, loading, error, uploadHistorico, removeHistorico } = useHistoricoStore()

  const [files, setFiles]         = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadOk, setUploadOk]   = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

 const handleUpload = useCallback(async () => {
    if (!files[0]) return
    setUploading(true)
    setUploadError(null)
    setUploadOk(false)
    try {
      await uploadHistorico(files[0], files[1] ?? null)
      setFiles([])
      setUploadOk(true)
      setTimeout(() => setUploadOk(false), 3000)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir el archivo")
    } finally {
      setUploading(false)
    }
  }, [files, uploadHistorico])

  const handleRemove = useCallback(async (id: string) => {
    setRemovingId(id)
    try { await removeHistorico(id) }
    finally { setRemovingId(null) }
  }, [removeHistorico])

  const totalRows = historicos.reduce((acc, h) => {
    const s1 = Object.values(h.sheets).reduce((a, rows) => a + rows.length, 0)
    const s2 = h.sheets2 ? Object.values(h.sheets2).reduce((a, rows) => a + rows.length, 0) : 0
    return acc + s1 + s2
  }, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-5 py-3.5 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary/15">
            <Upload className="h-3.5 w-3.5 text-secondary" />
          </div>
          <h3 className="text-sm font-semibold text-card-foreground">Cargar Excel histórico</h3>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sube uno o dos archivos <span className="font-semibold text-card-foreground">.xlsx</span> con el histórico de dictámenes.
            Los datos se usarán para autocompletar renovaciones.
          </p>
          <FileDropZone
            accept=".xlsx"
            hint=".xlsx · máx. 10 MB c/u — puedes subir hasta 2 archivos"
            files={files}
            onFilesChange={(fs) => { setFiles(fs.slice(0, 2)); setUploadError(null); setUploadOk(false) }}
          />
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button type="button" onClick={handleUpload} disabled={files.length === 0 || uploading} size="sm" className="gap-2">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Subiendo..." : "Subir archivos"}
            </Button>
            {uploadOk && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle2 className="h-4 w-4" />Subido correctamente
              </span>
            )}
            {uploadError && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />{uploadError}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">Archivos cargados</h3>
            {historicos.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-secondary/10 text-secondary w-5 h-5 text-xs font-semibold">
                {historicos.length}
              </span>
            )}
          </div>
          {historicos.length > 0 && (
            <span className="text-xs text-muted-foreground">{totalRows.toLocaleString()} registros en total</span>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 animate-spin" />Cargando archivos...
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-[8px] border-l-4 border-l-[var(--sem-support-error)] bg-[#FFF5F5] px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sem-support-error)] mt-0.5" />
            <span className="text-sm text-[var(--sem-support-error)]">{error}</span>
          </div>
        ) : historicos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/80">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin archivos cargados</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Sube un archivo .xlsx para comenzar</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden divide-y divide-border">
            {historicos.map((h) => {
              const rows1 = Object.values(h.sheets).reduce((a, r) => a + r.length, 0)
              const rows2 = h.sheets2 ? Object.values(h.sheets2).reduce((a, r) => a + r.length, 0) : 0
              const sheets1Count = h.sheetNames.length
              const sheets2Count = h.sheetNames2?.length ?? 0
              return (
                <div key={h.id} className="flex items-center gap-4 px-4 py-4 hover:bg-muted/20 transition-colors group">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/10 border border-secondary/15">
                    <FileText className="h-4 w-4 text-secondary" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-card-foreground truncate">{h.nombreArchivo}</span>
                      <span className="shrink-0 text-[10px] font-medium rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {sheets1Count} {sheets1Count === 1 ? "hoja" : "hojas"}
                      </span>
                    </div>
                    {h.nombreArchivo2 && (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground truncate">+ {h.nombreArchivo2}</span>
                        {sheets2Count > 0 && (
                          <span className="shrink-0 text-[10px] font-medium rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                            {sheets2Count} {sheets2Count === 1 ? "hoja" : "hojas"}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.subidoEn).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs text-muted-foreground/30">·</span>
                      <span className="text-xs font-semibold text-secondary">{(rows1 + rows2).toLocaleString()} registros</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(h.id)}
                    disabled={removingId === h.id}
                    className="rounded-lg p-2 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 shrink-0"
                  >
                    {removingId === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const BADGE = "ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-normal bg-[var(--sem-accent-primary)] text-white"
export function EntidadesPage() {
  const { user } = useAuth()
  const [cCount, setCCount] = useState<number | null>(null)
  const [pCount, setPCount] = useState<number | null>(null)
  const esParaestatal = user?.tipoAdministracion === "paraestatal"
  const verCentralizada = true
  const verParaestatal  = true
  const defaultTab = esParaestatal ? "paraestatal" : "centralizada"

  useEffect(() => {
    if (!verParaestatal) return
    fetchCategoriasParaestatal().then((data) => setPCount(data.length)).catch(() => {})
  }, [verParaestatal])

  return (
    <PageLayout
      title="Unidades Administrativas"
      description={
        esParaestatal
          ? "Gestión de estructuras organizacionales de la administración ."
          : "Gestión de estructuras organizacionales de la administración ."
      }
    >
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          {verCentralizada && (
            <TabsTrigger value="centralizada" className="gap-1.5">
              Centralizada
              {cCount !== null && <span className={BADGE}>{cCount}</span>}
            </TabsTrigger>
          )}
          {verParaestatal && (
            <TabsTrigger value="paraestatal" className="gap-1.5">
              Paraestatal
              {pCount !== null && <span className={BADGE}>{pCount}</span>}
            </TabsTrigger>
          )}
        </TabsList>
        {verCentralizada && (
          <TabsContent value="centralizada" className="mt-3">
            <CatalogoCentralizadaTab onCountChange={setCCount} />
          </TabsContent>
        )}
        {verParaestatal && (
          <TabsContent value="paraestatal" className="mt-3">
            <CatalogoParaestatalTab onCountChange={setPCount} />
          </TabsContent>
        )}
      </Tabs>
    </PageLayout>
  )
}
