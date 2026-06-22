"use client"

import { useRef, useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Building2, Landmark, FileSpreadsheet, Upload, Loader2, Trash2, FileText, AlertCircle, CheckCircle2 } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { CatalogoCentralizadaTab } from "@/components/catalogo-centralizada-tab"
import { CatalogoParaestatalTab } from "@/components/catalogo-paraestatal-tab"
import { useHistoricoStore } from "@/lib/historico-store"
import { Button } from "@/components/ui/button"

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

  const handleUpload = useCallback(async () => {
    if (!file1) return
    setUploading(true)
    setUploadError(null)
    setUploadOk(false)
    try {
      await uploadHistorico(file1, file2)
      setFile1(null)
      setFile2(null)
      setUploadOk(true)
      setTimeout(() => setUploadOk(false), 3000)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir el archivo")
    } finally {
      setUploading(false)
    }
  }, [file1, file2, uploadHistorico])

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
      <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-card-foreground">Cargar Excel histórico</h3>
          <p className="text-xs text-muted-foreground">
            Sube uno o dos archivos <span className="font-medium">.xlsx</span> con el histórico de dictámenes. Los datos se usarán para autocompletar renovaciones.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Archivo principal *</span>
            <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
              onChange={(e) => { setFile1(e.target.files?.[0] ?? null); setUploadError(null); setUploadOk(false) }} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-3 hover:bg-muted transition-colors cursor-pointer text-left w-full"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {file1 ? file1.name : "Seleccionar archivo .xlsx"}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Archivo secundario (opcional)</span>
            <input ref={input2Ref} type="file" accept=".xlsx" className="hidden"
              onChange={(e) => { setFile2(e.target.files?.[0] ?? null); setUploadError(null); setUploadOk(false) }} />
            <button
              type="button"
              onClick={() => input2Ref.current?.click()}
              className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/50 px-3 py-3 hover:bg-muted transition-colors cursor-pointer text-left w-full"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {file2 ? file2.name : "Seleccionar archivo .xlsx"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file1 || uploading}
            size="sm"
            className="gap-1.5"
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />}
            {uploading ? "Subiendo..." : "Subir"}
          </Button>
          {uploadOk && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />Subido correctamente
            </span>
          )}
          {uploadError && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />{uploadError}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground">
            Archivos cargados
            {historicos.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({historicos.length} {historicos.length === 1 ? "archivo" : "archivos"} · {totalRows} registros)
              </span>
            )}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />Cargando...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </div>
        ) : historicos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No hay archivos cargados</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {historicos.map((h) => {
              const rows1 = Object.values(h.sheets).reduce((a, r) => a + r.length, 0)
              const rows2 = h.sheets2 ? Object.values(h.sheets2).reduce((a, r) => a + r.length, 0) : 0
              return (
                <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-secondary" />
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-sm font-medium text-card-foreground truncate">{h.nombreArchivo}</span>
                    {h.nombreArchivo2 && (
                      <span className="text-xs text-muted-foreground truncate">{h.nombreArchivo2}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.subidoEn).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{rows1 + rows2} registros
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(h.id)}
                    disabled={removingId === h.id}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 shrink-0"
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

          {/* <TabsTrigger value="historico" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Histórico
          </TabsTrigger> */}

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
