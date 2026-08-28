"use client"

import { useEffect, useState,useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { SessionInvalidWatcher } from "@/components/session-invalid-watcher"
import { AppSidebar, type PageKey } from "@/components/app-sidebar"
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
import { EntidadesPage } from "@/components/pages/entidades-page"
import { CatalogoJustificacionesPage } from "@/components/pages/catalogo-justificaciones-page"
import { ProgresoFirmadoPage } from "@/components/pages/progreso-firmado-page"
import { WelcomePage } from "@/components/welcome-splash"
import { SidebarContext } from '@/context/sidebar-context';

const PAGE_KEY    = "sdtf_current_page"
const SIDEBAR_KEY = "sdtf_sidebar_collapsed"

export function AppShell() {
  const { user } = useAuth()
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [reviewSolicitudId, setReviewSolicitudId] = useState<string | null>(null)
  const [reviewFiltro, setReviewFiltro] = useState<1 | 2 | 3>(1)
  const [editSolicitud, setEditSolicitud] = useState<EditSolicitudPayload | undefined>(undefined)
  const [hydrated, setHydrated] = useState(false)
  const [menuReady, setMenuReady] = useState(false)
  const [showSplash, setShowSplash] = useState(false)
  const [prevPage, setPrevPage] = useState<PageKey>("dashboard")
  const [misSolicitudesRefreshKey, setMisSolicitudesRefreshKey] = useState(0)
  const [misSolicitudesInitialTab, setMisSolicitudesInitialTab] = useState<string | undefined>(undefined)
   const [collapsed, setCollapsed] = useState(false);
   const toggle = useCallback(() => setCollapsed((c) => !c), []);

  useEffect(() => {
    const storedPage = localStorage.getItem(PAGE_KEY) as PageKey | null
    if (storedPage && storedPage !== "revision-do") setCurrentPage(storedPage)
    const storedSidebar = localStorage.getItem(SIDEBAR_KEY)
    if (storedSidebar === "true") setSidebarCollapsed(true)
    if (sessionStorage.getItem("sdtf_just_logged_in")) {
      sessionStorage.removeItem("sdtf_just_logged_in")
      setShowSplash(true)
    }
    setHydrated(true)
  }, [])

  // Mantiene el sidebar sincronizado con el breakpoint md (768px) en todo momento,
  // no solo al montar: el zoom del navegador y el resize de ventana cambian el ancho
  // efectivo en vivo, y sin este listener el sidebar se queda "abierto en escritorio"
  // (position: fixed superpuesto al contenido) cuando el CSS ya cruzó a modo móvil.
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)")
    if (mql.matches) setCollapsed(true)
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setCollapsed(true)
    }
    mql.addEventListener("change", handleChange)
    return () => mql.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(PAGE_KEY, currentPage)
  }, [currentPage, hydrated])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed, hydrated])

  const handleNavigate = (page: PageKey) => {
    setShowSplash(false)
    if (page !== "nueva-solicitud") setEditSolicitud(undefined)
    setCurrentPage(page)
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setCollapsed(true)
    }
  }

  const handleEditSolicitud = (payload: EditSolicitudPayload) => {
    setPrevPage(currentPage)
    setEditSolicitud(payload)
    setCurrentPage("nueva-solicitud")
  }

  const handleCancelEdit = () => {
    setEditSolicitud(undefined)
    setCurrentPage(prevPage)
  }

  const handleAfterSave = () => {
    const estadoOrig = (editSolicitud?.estado ?? "").toLowerCase()
    const eraObservada = estadoOrig.includes("observad") || estadoOrig.includes("devuelta")
    const getInitialTab = (): string | undefined => {
      if (!eraObservada) return undefined
      return "En aprobación"
    }
    if (prevPage === "mis-solicitudes") {
      setMisSolicitudesInitialTab(getInitialTab())
      setMisSolicitudesRefreshKey((k) => k + 1)
    } else if (eraObservada && (
      (prevPage as string).startsWith("bandeja-filtro") || prevPage === "revision-do"
    )) {
      setMisSolicitudesRefreshKey((k) => k + 1)
    }
    setEditSolicitud(undefined)
    setCurrentPage(prevPage)
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
        return <NuevaSolicitudPage key={editSolicitud?.id ?? "new"} editSolicitud={editSolicitud} onAfterSave={editSolicitud ? handleAfterSave : undefined} onCancel={editSolicitud ? handleCancelEdit : undefined} onGoToBandeja={() => setCurrentPage("mis-solicitudes")} />
      case "mis-solicitudes":
        return <MisSolicitudesPage key={`${user?.id ?? "anon"}-${misSolicitudesRefreshKey}`} initialTab={misSolicitudesInitialTab} onEditSolicitud={handleEditSolicitud} />
      case "validacion-uefa":
        return <ValidacionUefaPage onEditSolicitud={handleEditSolicitud} />
      case "bandeja-filtro1":
        return <BandejaFiltroPage key={`f1-${misSolicitudesRefreshKey}`} filtro={1} onOpenReview={handleOpenReview} onEditSolicitud={handleEditSolicitud} />
      case "bandeja-filtro2":
        return <BandejaFiltroPage key={`f2-${misSolicitudesRefreshKey}`} filtro={2} onOpenReview={handleOpenReview} onEditSolicitud={handleEditSolicitud} />
      case "bandeja-filtro3":
        return <BandejaFiltroPage key={`f3-${misSolicitudesRefreshKey}`} filtro={3} onOpenReview={handleOpenReview} onEditSolicitud={handleEditSolicitud} />
      case "progreso-firmado":
        return <ProgresoFirmadoPage />
      case "revision-do":
        return reviewSolicitudId ? (
          <RevisionDOPage key={`rev-${misSolicitudesRefreshKey}`} solicitudId={reviewSolicitudId} filtro={reviewFiltro} onBack={handleBackFromReview} onEditSolicitud={handleEditSolicitud} />
        ) : (
          <DashboardPage onNavigate={setCurrentPage} onOpenReview={handleOpenReview} />
        )

      case "dictamenes":
        return <DictamenesPage />

      case "calendario":
        return <CalendarioPage />
      case "usuarios":
        return <UsuariosPage />
      case "catalogo-justificaciones":
        return <CatalogoJustificacionesPage />
      case "entidades":
      case "configuracion":
      case "dependencia":
      case "dependencias":
        return <EntidadesPage />
      case "perfil":
        return <PerfilPage />
      default:
        return <DashboardPage onNavigate={setCurrentPage} onOpenReview={handleOpenReview} />
    }
  }

  const sidebarCurrentPage: PageKey =
    currentPage === "revision-do"
      ? (`bandeja-filtro${reviewFiltro}` as PageKey)
      : currentPage

  return (
    <SidebarContext.Provider value={{ collapsed , toggle }}>
      <SessionInvalidWatcher />
      <div className="flex h-screen overflow-hidden bg-bg-surface-low p-1 md:p-2 gap-1 md:gap-2">
        <AppSidebar
          currentPage={sidebarCurrentPage}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onMenuReady={setMenuReady}
        />
        {!collapsed && (
          <div
            aria-hidden
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setCollapsed(true)}
          />
        )}
        <main className="flex flex-1 flex-col overflow-y-auto bg-bg-base rounded-xl min-w-0">
          {showSplash && user
            ? <WelcomePage userName={user.nombre} userRole={user.rol} />
            : menuReady ? renderPage() : null
          }
        </main>
      </div>
    </SidebarContext.Provider>
  )
}
