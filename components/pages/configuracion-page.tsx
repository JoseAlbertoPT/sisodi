"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileSpreadsheet, Trash2, Settings, Building2, Landmark } from "lucide-react"
import { useHistoricoStore } from "@/lib/historico-store"
import { PageLayout } from "@/components/page-layout"
import { CatalogoCentralizadaTab } from "@/components/catalogo-centralizada-tab"
import { CatalogoParaestatalTab } from "@/components/catalogo-paraestatal-tab"

export function ConfiguracionPage() {
  const { historicos, loading, error, uploadHistorico, removeHistorico } = useHistoricoStore()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      setUploadError(null)
      setUploadSuccess(null)
      if (!file) return
      if (!file.name.endsWith(".xlsx")) {
        setUploadError("Solo se aceptan archivos .xlsx")
        return
      }
      setUploading(true)
      try {
        const record = await uploadHistorico(file)
        setUploadSuccess(`Archivo "${record.nombreArchivo}" guardado con ${record.sheetNames.length} hoja(s).`)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Error al guardar")
      } finally {
        setUploading(false)
      }
    },
    [uploadHistorico]
  )

  const handleRemove = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        await removeHistorico(id)
      } catch {
        setUploadError("Error al eliminar")
      } finally {
        setDeletingId(null)
      }
    },
    [removeHistorico]
  )

  return (
    <PageLayout
      title={<span className="flex items-center gap-2"><Settings className="h-5 w-5 text-secondary" />Configuracion</span>}
      description="Parametros y cargas de datos del sistema (historico de justificaciones, etc.)."
    >

      <Tabs defaultValue="historico" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="historico" className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            Historico Excel
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
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-card-foreground">
                Subir Excel de justificaciones
              </CardTitle>
              <CardDescription>
                Cargue el archivo de justificaciones (ej. Justificaciones 2025-2026.xlsx) con sus hojas (SSyPC, AGROPECUARIO, EDUCACION, etc.). Los datos se guardan para poder usarlos al llenar una nueva solicitud.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Archivo .xlsx</Label>
                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="bg-background cursor-pointer file:cursor-pointer max-w-xs"
                  />
                  {uploading && <span className="text-sm text-muted-foreground">Subiendo...</span>}
                </div>
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {uploadError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="rounded-md bg-secondary/10 border border-secondary/20 px-3 py-2 text-sm text-secondary">
                  {uploadSuccess}
                </div>
              )}
            </CardContent>
          </Card>

          {loading && historicos.length === 0 && (
            <p className="text-sm text-muted-foreground">Cargando historicos...</p>
          )}
          {!loading && historicos.length > 0 && (
            <Card className="shadow-sm border-border mt-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-card-foreground">
                  Historicos guardados
                </CardTitle>
                <CardDescription>
                  Archivos cargados en el backend (Postgres). Puede usarlos en Nueva Solicitud.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {historicos.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium text-card-foreground truncate">
                          {h.nombreArchivo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.subidoEn).toLocaleString("es-MX")} – {h.sheetNames.length} hoja(s): {h.sheetNames.join(", ")}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => void handleRemove(h.id)}
                        disabled={deletingId === h.id}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
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
