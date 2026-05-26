"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Building2, Landmark } from "lucide-react"
import { PageLayout } from "@/components/page-layout"
import { CatalogoCentralizadaTab } from "@/components/catalogo-centralizada-tab"
import { CatalogoParaestatalTab } from "@/components/catalogo-paraestatal-tab"

export function ConfiguracionPage() {
  return (
    <PageLayout
      title={<span className="flex items-center gap-2"><Settings className="h-5 w-5 text-secondary" />Catálogo</span>}
      description="Gestión de estructuras organizacionales de la administración centralizada y paraestatal."
    >
      <Tabs defaultValue="centralizada" className="w-full">
        <TabsList className="bg-muted">
          <TabsTrigger value="centralizada" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Centralizada
          </TabsTrigger>
          <TabsTrigger value="paraestatal" className="gap-1.5">
            <Landmark className="h-4 w-4" />
            Paraestatal
          </TabsTrigger>
        </TabsList>
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
