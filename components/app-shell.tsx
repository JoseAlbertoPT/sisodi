"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar, type PageKey } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardPage } from "@/components/pages/dashboard-page"
import { BandejaFiltroPage } from "@/components/pages/bandeja-filtro-page"
import { RevisionDOPage } from "@/components/pages/revision-do-page"
import { NuevaSolicitudPage, type EditSolicitudPayload } from "@/components/pages/nueva-solicitud-page"
import { MisSolicitudesPage } from "@/components/pages/mis-solicitudes-page"
import { DictamenesPage } from "@/components/pages/dictamenes-page"

import { CalendarioPage } from "@/components/pages/calendario-page"
import { UsuariosPage } from "@/components/pages/usuarios-page"
import { PerfilPage } from "@/components/pages/perfil-page"
import { ValidacionUefaPage } from "@/components/pages/validacion-uefa-page"
import { ConfiguracionPage } from "@/components/pages/configuracion-page"

export function AppShell() {
  const { user } = useAuth()
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [reviewSolicitudId, setReviewSolicitudId] = useState<string | null>(null)
  const [reviewFiltro, setReviewFiltro] = useState<1 | 2 | 3>(1)
  const [editSolicitud, setEditSolicitud] = useState<EditSolicitudPayload | undefined>(undefined)

  const handleNavigate = (page: PageKey) => {
    if (page !== "nueva-solicitud") setEditSolicitud(undefined)
    setCurrentPage(page)
  }

  const handleEditSolicitud = (payload: EditSolicitudPayload) => {
    setEditSolicitud(payload)
    setCurrentPage("nueva-solicitud")
  }

  const handleOpenReview = (solicitudId: string, filtro: 1 | 2 | 3) => {
    setReviewSolicitudId(solicitudId)
    setReviewFiltro(filtro)
    setCurrentPage("revision-do")
  }

  const handleBackFromReview = (filtro: 1 | 2 | 3) => {
    setReviewSolicitudId(null)
    setCurrentPage(`bandeja-filtro${filtro}` as PageKey)
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentPage} onOpenReview={handleOpenReview} />
      case "nueva-solicitud":
        return <NuevaSolicitudPage key={editSolicitud?.id ?? "new"} editSolicitud={editSolicitud} />
      case "mis-solicitudes":
        return <MisSolicitudesPage key={user?.id ?? "anon"} onEditSolicitud={handleEditSolicitud} />
      case "validacion-uefa":
        return <ValidacionUefaPage />
      case "bandeja-filtro1":
        return <BandejaFiltroPage filtro={1} onOpenReview={handleOpenReview} />
      case "bandeja-filtro2":
        return <BandejaFiltroPage filtro={2} onOpenReview={handleOpenReview} />
      case "bandeja-filtro3":
        return <BandejaFiltroPage filtro={3} onOpenReview={handleOpenReview} />
      case "revision-do":
        return reviewSolicitudId ? (
          <RevisionDOPage solicitudId={reviewSolicitudId} filtro={reviewFiltro} onBack={handleBackFromReview} />
        ) : (
          <DashboardPage onNavigate={setCurrentPage} onOpenReview={handleOpenReview} />
        )

      case "dictamenes":
        return <DictamenesPage />

      case "calendario":
        return <CalendarioPage />
      case "usuarios":
        return <UsuariosPage />
      case "configuracion":
        return <ConfiguracionPage />
      case "perfil":
        return <PerfilPage />
      default:
        return <DashboardPage onNavigate={setCurrentPage} onOpenReview={handleOpenReview} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex flex-1 flex-col overflow-y-auto p-6">
        {renderPage()}
      </main>
    </div>
  )
}
