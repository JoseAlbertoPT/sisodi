"use client"

import { useRef, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Building2, Landmark, FileSpreadsheet, Upload, Loader2, Trash2, FileText, AlertCircle, CheckCircle2, X } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { CatalogoCentralizadaTab } from "@/components/catalogo-centralizada-tab"
import { CatalogoParaestatalTab } from "@/components/catalogo-paraestatal-tab"
import { useHistoricoStore } from "@/lib/historico-store"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function HistoricoTab() {
  const { historicos, loading, error, uploadHistorico, removeHistorico } = useHistoricoStore()

  const inputRef  = useRef<HTMLInputElement>(null)
  const input2Ref = useRef<HTMLInputElement>(null)

  const [file1, setFile1]       = useState<File | null>(null)
  const [file2, setFile2]       = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadOk, setUploadOk]   = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const clearFile1 = useCallback(() => {
    setFile1(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const clearFile2 = useCallback(() => {
    setFile2(null)
    if (input2Ref.current) input2Ref.current.value = ""
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file1) return
    setUploading(true)
    setUploadError(null)
    setUploadOk(false)
    try {
      await uploadHistorico(file1, file2)
      clearFile1()
      clearFile2()
      setUploadOk(true)
      setTimeout(() => setUploadOk(false), 3000)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir el archivo")
    } finally {
      setUploading(false)
    }
  }, [file1, file2, uploadHistorico, clearFile1, clearFile2])

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
      {/* Upload card */}
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

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Archivo 1 */}

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subir Archivo </span>
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { setFile1(e.target.files?.[0] ?? null); setUploadError(null); setUploadOk(false) }} />
              {file1 ? (
                <div className="flex items-center gap-2.5 rounded-lg border-2 border-secondary/30 bg-secondary/5 px-3.5 py-3">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-secondary" />
                  <span className="text-sm text-card-foreground font-medium truncate flex-1">{file1.name}</span>
                  <button type="button" onClick={clearFile1}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-2.5 rounded-lg border-2 border-dashed border-border bg-muted/20 px-3.5 py-3 hover:bg-muted/50 hover:border-secondary/30 transition-colors cursor-pointer text-left w-full group">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-secondary transition-colors" />
                  <span className="text-sm text-muted-foreground">Seleccionar archivo .xlsx</span>
                </button>
              )}
            </div>

            {/* Archivo 2 */}
            {file1 && <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
               Subir  Archivo  <span className="font-normal normal-case opacity-60">(opcional)</span>
              </span>
              <input ref={input2Ref} type="file" accept=".xlsx" className="hidden"
                onChange={(e) => { setFile2(e.target.files?.[0] ?? null); setUploadError(null); setUploadOk(false) }} />
              {file2 ? (
                <div className="flex items-center gap-2.5 rounded-lg border-2 border-secondary/30 bg-secondary/5 px-3.5 py-3">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-secondary" />
                  <span className="text-sm text-card-foreground font-medium truncate flex-1">{file2.name}</span>
                  <button type="button" onClick={clearFile2}
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => input2Ref.current?.click()}
                  className="flex items-center gap-2.5 rounded-lg border-2 border-dashed border-border bg-muted/20 px-3.5 py-3 hover:bg-muted/50 hover:border-secondary/30 transition-colors cursor-pointer text-left w-full group">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-secondary transition-colors" />
                  <span className="text-sm text-muted-foreground">Seleccionar archivo .xlsx</span>
                </button>
              )}
            </div>}
          </div>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file1 || uploading}
              size="sm"
              className="gap-2"
            >
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />}
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

      {/* Files list */}
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
          <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
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
                    {removingId === h.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
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

export function ConfiguracionPage() {
  return (
    <PageLayout
      title={<span className="flex items-center gap-2"><Settings className="h-5 w-5 text-secondary" />Catálogo</span>}
      description="Gestión de estructuras organizacionales de la administración centralizada y paraestatal."
    >
      <Tabs defaultValue="centralizada" className="w-full">
        <TabsList className="bg-muted">

          <TabsTrigger value="historico" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Histórico
          </TabsTrigger>

          <TabsTrigger value="centralizada" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Centralizada
          </TabsTrigger>
          <TabsTrigger value="paraestatal" className="gap-1.5">
            <Landmark className="h-4 w-4" />
            Paraestatal
          </TabsTrigger>
        </TabsList>
        <TabsContent value="historico" className="mt-6">
          <HistoricoTab />
        </TabsContent>
        <TabsContent value="centralizada" className="mt-6">
          <CatalogoCentralizadaTab />
        </TabsContent>
        <TabsContent value="paraestatal" className="mt-6">
          <CatalogoParaestatalTab />
        </TabsContent>
      </Tabs>
    </PageLayout>
  )
}
