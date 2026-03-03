"use client"

import { useState } from "react"
import { AppSidebar, type PageKey } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardPage } from "@/components/pages/dashboard-page"
import { BandejaFiltroPage } from "@/components/pages/bandeja-filtro-page"
import { RevisionDOPage } from "@/components/pages/revision-do-page"
import { NuevaSolicitudPage } from "@/components/pages/nueva-solicitud-page"
import { MisSolicitudesPage } from "@/components/pages/mis-solicitudes-page"
import { DictamenesPage } from "@/components/pages/dictamenes-page"

import { CalendarioPage } from "@/components/pages/calendario-page"
import { UsuariosPage } from "@/components/pages/usuarios-page"
import { PerfilPage } from "@/components/pages/perfil-page"
import { ValidacionUefaPage } from "@/components/pages/validacion-uefa-page"


export function AppShell() {
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [reviewSolicitudId, setReviewSolicitudId] = useState<string | null>(null)
  const [reviewFiltro, setReviewFiltro] = useState<1 | 2 | 3>(1)

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
        return <NuevaSolicitudPage />
      case "mis-solicitudes":
        return <MisSolicitudesPage />
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
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
