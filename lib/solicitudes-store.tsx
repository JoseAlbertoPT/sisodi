"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export const ESTADOS = [
  "Borrador",
  "En Validacion Justificaciones",
  "Observado por Validacion",
  "En Revision Revisor",
  "Observado por Revisor",
  "Pendiente Firma Justificacion",
  "En Verificacion Final",
  "Observado por Verificacion Final",
  "En Revision Emisor",
  "Observado por Emisor",
  "Pendiente Firma Dictamen",
  "Emitido",
] as const

export type Estado = (typeof ESTADOS)[number]

export function getSlaColor(diasRestantes: number | null): string {
  if (diasRestantes === null) return "text-muted-foreground"
  if (diasRestantes <= 0) return "text-destructive"
  if (diasRestantes <= 5) return "text-[#c57a2a]"
  if (diasRestantes <= 10) return "text-accent"
  return "text-secondary"
}

export function getSlaBackground(diasRestantes: number | null): string {
  if (diasRestantes === null) return "bg-muted"
  if (diasRestantes <= 0) return "bg-destructive/10"
  if (diasRestantes <= 5) return "bg-[#c57a2a]/10"
  if (diasRestantes <= 10) return "bg-accent/10"
  return "bg-secondary/10"
}

export function getSlaLabel(diasRestantes: number | null): string {
  if (diasRestantes === null) return "N/A"
  if (diasRestantes <= 0) return "Vencido"
  return `${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`
}

export function getEstadoVariant(estado: Estado) {
  switch (estado) {
    case "Borrador":
      return { bg: "bg-muted", text: "text-muted-foreground" }
    case "En Validacion Justificaciones":
      return { bg: "bg-primary/10", text: "text-primary" }
    case "Observado por Validacion":
      return { bg: "bg-[var(--color-core-mora-20)]/10", text: "text-[var(--color-core-mora-20)]" }
    case "En Revision Revisor":
    case "En Verificacion Final":
    case "En Revision Emisor":
      return { bg: "bg-secondary/10", text: "text-secondary" }
    case "Observado por Revisor":
    case "Observado por Verificacion Final":
    case "Observado por Emisor":
      return { bg: "bg-[var(--color-core-mora-20)]/10", text: "text-[var(--color-core-mora-20)]" }
    case "Pendiente Firma Justificacion":
      return { bg: "bg-accent/10", text: "text-accent-foreground" }
    case "Pendiente Firma Dictamen":
      return { bg: "bg-secondary/20", text: "text-secondary" }
    case "Emitido":
      return { bg: "bg-primary", text: "text-primary-foreground" }
    default:
      return { bg: "bg-muted", text: "text-muted-foreground" }
  }
}

const MONTH_CODES: Record<number, string> = {
  0: "EN", 1: "FE", 2: "MR", 3: "AB", 4: "MY", 5: "JN",
  6: "JL", 7: "AG", 8: "SE", 9: "OC", 10: "NV", 11: "DI",
}

export interface HistorialEntry {
  fecha: string
  usuario: string
  accion: string
  estadoAnterior: Estado | null
  estadoNuevo: Estado
  visibilidadDO?: boolean
}

export interface ObservacionSeccion {
  seccion: string
  observacion: string
}

export type ChecklistValor = "si" | "no" | "noAplica" | null

export interface ChecklistItemState {
  valor: ChecklistValor
  observacion: string
  validadoPor: string | null
  validadoEn: string | null
}

export type ChecklistDO = Record<string, ChecklistItemState>

export const CHECKLIST_PRESTACION_SERVICIOS = [
  { key: "oficioSolicitud", label: "Oficio de solicitud adjunto", num: 1 },
  { key: "secretariaDependencia", label: "Secretaria/Subsecretaria/Dependencia correcta", num: 2 },
  { key: "unidadAdministrativa", label: "Unidad Administrativa de Adscripcion", num: 3 },
  { key: "unidadResponsableGasto", label: "Unidad Responsable del Gasto", num: 4 },
  { key: "programaProyecto", label: "Programa o Proyecto", num: 5 },
  { key: "regimenContratacion", label: "Regimen de contratacion correcto", num: 6 },
  { key: "tipoActividad", label: "Tipo de Actividad especificado", num: 7 },
  { key: "numJustificaciones", label: "Numero de justificaciones", num: 8 },
  { key: "numPrestadores", label: "Numero de prestadores de servicio", num: 9 },
  { key: "vigenciaCorrecta", label: "Vigencia correcta (inicio y termino)", num: 10 },
  { key: "importeBruto", label: "Importe Bruto conforme al tabulador vigente", num: 11 },
  { key: "ordenamientosLegales", label: "Ordenamientos legales y administrativos citados", num: 12 },
  { key: "fechaPublicacion", label: "Fecha de publicacion en periodico oficial", num: 13 },
  { key: "oficioSuficiencia", label: "Oficio de suficiencia presupuestal adjunto", num: 14 },
  { key: "convenioAnexos", label: "Convenio y anexos si aplica recurso federal", num: 15 },
  { key: "documentacionCompleta", label: "Documentacion completa conforme a lineamientos", num: 16 },
] as const

export const CHECKLIST_TIEMPO_DETERMINADO_EXTRA = [
  { key: "denominacionNombramiento", label: "Denominacion del nombramiento", num: 17 },
  { key: "equivalenciaTabulador", label: "Equivalencia conforme al Tabulador (Nivel/Categoria correcta)", num: 18 },
  { key: "clavePresupuestal", label: "Clave presupuestal valida", num: 19 },
] as const

export function getChecklistItems(tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Det.") {
  if (tipo === "Nombramiento Tiempo Det.") {
    return [...CHECKLIST_PRESTACION_SERVICIOS, ...CHECKLIST_TIEMPO_DETERMINADO_EXTRA]
  }
  return [...CHECKLIST_PRESTACION_SERVICIOS]
}

export function createEmptyChecklist(tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Det."): ChecklistDO {
  const items = getChecklistItems(tipo)
  const checklist: ChecklistDO = {}
  items.forEach((item) => {
    checklist[item.key] = { valor: null, observacion: "", validadoPor: null, validadoEn: null }
  })
  return checklist
}

export interface EmisionData {
  numeroDictamen: string
  fechaDictaminacion: string
  modalidadFirma: "electronica" | "autografa"
  destinatarios: string[]
  firmadoPor: {
    reviso: string
    valido: string
    emitio: string
  }
  archivoFirmado: string | null
  fechaEmision: string
}

export type TipoAdministracion = "centralizada" | "paraestatal"

export interface Solicitud {
  id: string
  folioSolicitud: string
  folioRecepcion: string | null
  tipo: "Prestacion de Servicios" | "Nombramiento Tiempo Det."
  tipoAdministracion: TipoAdministracion
  secretaria: string
  unidadAdministrativa: string
  estado: Estado
  fechaCreacion: string
  fechaRecepcionDO: string | null
  slaRestante: number | null
  slaDiasHabiles: number
  historial: HistorialEntry[]
  observaciones: string[]
  observacionesPorSeccion: ObservacionSeccion[]
  checklistDO: ChecklistDO
  denominacion: string
  vigenciaInicio: string
  vigenciaFin: string
  importeBruto: string
  esRenovacion: boolean
  folioAnterior: string | null
  reingresoCount: number
  lastObservedStage: 1 | 2 | 3 | null
  lastObservedDate: string | null
  openedInFiltro: Record<number, boolean>
  isNuevaEnFiltro: Record<number, boolean>
  emisionData: EmisionData | null
  esExcepcionDO: boolean
  folioRecepcionManual: boolean
  esRegularizacion: boolean
  folioTemporal: boolean
  folioTemporalOriginal: string | null
  folioOficializadoPor: string | null
  fechaOficializacion: string | null
  folioDictamen: string | null
  folioDictamenMes: number | null
  folioDictamenAnio: number | null
  folioDictamenConsecutivo: number | null
  folioDictamenAsignadoPor: string | null
  fechaAsignacionFolioDictamen: string | null
  folioJustificacion: string | null
  folioJustificacionAnio: number | null
  folioJustificacionConsecutivo: number | null
  marco_normativo: string[]
  riesgo_caidas: string
  riesgo_mutilaciones: string
  riesgo_golpes: string
  riesgo_otros: string
  condicion_cambio_domicilio: boolean
  condicion_horario: boolean
  condicion_viajar: boolean
  resguardo_activos: string | null
}

function createSeedData(): Solicitud[] {
  return [
    {
      id: "sol-001",
      folioSolicitud: "SDTF-2026-0142",
      folioRecepcion: "FE-001",
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Finanzas",
      unidadAdministrativa: "Dir. Gral. de Administracion y Finanzas",
      estado: "En Revision Revisor",
      fechaCreacion: "2026-02-10",
      fechaRecepcionDO: "2026-02-12",
      slaRestante: 9,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-10 09:00", usuario: "Juan Perez", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-10 10:30", usuario: "Juan Perez", accion: "Enviada a validacion UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-11 11:00", usuario: "UEFA Validador", accion: "Validacion aprobada por UEFA", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-12 08:30", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-001 asignado", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Analista de Sistemas",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-08-31",
      importeBruto: "$45,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 1: true },
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacion: "JUST-2026-0001",
      folioJustificacionAnio: 2026,
      folioJustificacionConsecutivo: 1,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-002",
      folioSolicitud: "SDTF-2026-0141",
      folioRecepcion: "FE-002",
      tipo: "Nombramiento Tiempo Det.",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Educacion",
      unidadAdministrativa: "Dir. Gral. de Profesionalizacion",
      estado: "En Verificacion Final",
      fechaCreacion: "2026-02-08",
      fechaRecepcionDO: "2026-02-10",
      slaRestante: 6,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-08 09:00", usuario: "Maria Lopez", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-08 14:00", usuario: "Maria Lopez", accion: "Enviada a validacion UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-09 10:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-10 09:00", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-002 asignado", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-13 15:00", usuario: "Revisor Filtro 1", accion: "Aprobada en Filtro 1", estadoAnterior: "En revision DO Filtro 1", estadoNuevo: "En Verificacion Final" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Nombramiento Tiempo Det."),
      denominacion: "Jefe de Departamento",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-08-31",
      importeBruto: "$28,500.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 2: true },
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacion: "JUST-2026-0002",
      folioJustificacionAnio: 2026,
      folioJustificacionConsecutivo: 2,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-003",
      folioSolicitud: "SDTF-2026-0140",
      folioRecepcion: "FE-003",
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Salud",
      unidadAdministrativa: "Dir. Gral. de Recursos Humanos",
      estado: "En Revision Emisor",
      fechaCreacion: "2026-02-05",
      fechaRecepcionDO: "2026-02-07",
      slaRestante: 3,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-05 09:00", usuario: "Carlos Garcia", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-05 11:00", usuario: "Carlos Garcia", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-06 10:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-07 08:00", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-003", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-10 14:00", usuario: "Revisor Filtro 1", accion: "Aprobada en Filtro 1", estadoAnterior: "En revision DO Filtro 1", estadoNuevo: "En Verificacion Final" },
        { fecha: "2026-02-14 11:00", usuario: "Revisor Filtro 2", accion: "Aprobada en Filtro 2", estadoAnterior: "En revision DO Filtro 2", estadoNuevo: "En Revision Emisor" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Coordinador de Enfermeria",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-06-30",
      importeBruto: "$35,000.00",
      esRenovacion: true,
      folioAnterior: "DICT-2025-015",
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 3: true },
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: "01/02/2026",
      folioDictamenMes: 2,
      folioDictamenAnio: 2026,
      folioDictamenConsecutivo: 1,
      folioDictamenAsignadoPor: "Revisor Filtro 2",
      fechaAsignacionFolioDictamen: "2026-02-14 11:00",
      folioJustificacion: "JUST-2026-0003",
      folioJustificacionAnio: 2026,
      folioJustificacionConsecutivo: 3,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-004",
      folioSolicitud: "SDTF-2026-0139",
      folioRecepcion: "FE-004",
      tipo: "Nombramiento Tiempo Det.",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Gobierno",
      unidadAdministrativa: "Dir. Gral. de Profesionalizacion",
      estado: "Observado por Revisor",
      fechaCreacion: "2026-02-04",
      fechaRecepcionDO: "2026-02-06",
      slaRestante: 2,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-04 10:00", usuario: "Ana Martinez", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-04 15:00", usuario: "Ana Martinez", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-05 09:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-06 08:30", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-004", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-11 10:00", usuario: "Revisor Filtro 1", accion: "Observada - Falta oficio de suficiencia presupuestal", estadoAnterior: "En revision DO Filtro 1", estadoNuevo: "Observado por Revisor" },
      ],
      observaciones: ["Falta oficio de suficiencia presupuestal firmado"],
      observacionesPorSeccion: [
        { seccion: "Datos Generales", observacion: "Falta oficio de suficiencia presupuestal firmado" }
      ],
      checklistDO: createEmptyChecklist("Nombramiento Tiempo Det."),
      denominacion: "Subdirector de Area",
      vigenciaInicio: "2026-04-01",
      vigenciaFin: "2026-09-30",
      importeBruto: "$52,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: 1,
      lastObservedDate: "2026-02-11",
      openedInFiltro: { 1: true },
      isNuevaEnFiltro: {},
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: 4,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-005",
      folioSolicitud: "SDTF-2026-0138",
      folioRecepcion: "FE-005",
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Obras",
      unidadAdministrativa: "Dir. Gral. de Administracion y Finanzas",
      estado: "En Revision Revisor",
      fechaCreacion: "2026-02-12",
      fechaRecepcionDO: "2026-02-14",
      slaRestante: 12,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-12 09:00", usuario: "Roberto Silva", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-12 16:00", usuario: "Roberto Silva", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-13 11:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-14 09:00", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-005", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Ingeniero Civil Senior",
      vigenciaInicio: "2026-03-15",
      vigenciaFin: "2026-09-15",
      importeBruto: "$55,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 1: true },
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: 5,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-006",
      folioSolicitud: "SDTF-2026-0137",
      folioRecepcion: "FE-006",
      tipo: "Nombramiento Tiempo Det.",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Finanzas",
      unidadAdministrativa: "Dir. Gral. de Recursos Humanos",
      estado: "Pendiente Firma Dictamen",
      fechaCreacion: "2026-02-01",
      fechaRecepcionDO: "2026-02-03",
      slaRestante: null,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-01 09:00", usuario: "Luis Torres", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-01 14:00", usuario: "Luis Torres", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-02 10:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-03 08:00", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-006", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-05 14:00", usuario: "Revisor Filtro 1", accion: "Aprobada en Filtro 1", estadoAnterior: "En revision DO Filtro 1", estadoNuevo: "En Verificacion Final" },
        { fecha: "2026-02-10 10:00", usuario: "Revisor Filtro 2", accion: "Aprobada en Filtro 2", estadoAnterior: "En revision DO Filtro 2", estadoNuevo: "En Revision Emisor" },
        { fecha: "2026-02-14 16:00", usuario: "Director General", accion: "Aprobada en Filtro 3 (DG)", estadoAnterior: "En revision DO Filtro 3", estadoNuevo: "Pendiente Firma Dictamen" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Nombramiento Tiempo Det."),
      denominacion: "Coordinador Administrativo",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-08-31",
      importeBruto: "$38,000.00",
      esRenovacion: true,
      folioAnterior: "DICT-2025-012",
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: {},
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: "02/02/2026",
      folioDictamenMes: 2,
      folioDictamenAnio: 2026,
      folioDictamenConsecutivo: 2,
      folioDictamenAsignadoPor: "Revisor Filtro 2",
      fechaAsignacionFolioDictamen: "2026-02-10 10:00",
      folioJustificacionConsecutivo: 6,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-007",
      folioSolicitud: "SDTF-2026-0136",
      folioRecepcion: "FE-007",
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Salud",
      unidadAdministrativa: "Dir. Gral. de Profesionalizacion",
      estado: "Emitido",
      fechaCreacion: "2026-01-28",
      fechaRecepcionDO: "2026-01-30",
      slaRestante: null,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-01-28 09:00", usuario: "Patricia Ruiz", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-01-28 11:00", usuario: "Patricia Ruiz", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-01-29 10:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-01-30 08:00", usuario: "DO Recepcion", accion: "Recibida en DO", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-03 14:00", usuario: "Revisor Filtro 1", accion: "Aprobada", estadoAnterior: "En revision DO Filtro 1", estadoNuevo: "En Verificacion Final" },
        { fecha: "2026-02-06 10:00", usuario: "Revisor Filtro 2", accion: "Aprobada", estadoAnterior: "En revision DO Filtro 2", estadoNuevo: "En Revision Emisor" },
        { fecha: "2026-02-10 15:00", usuario: "Director General", accion: "Aprobada en DG", estadoAnterior: "En revision DO Filtro 3", estadoNuevo: "Pendiente Firma Dictamen" },
        { fecha: "2026-02-12 10:00", usuario: "Sistema", accion: "Dictamen emitido", estadoAnterior: "Aprobado", estadoNuevo: "Emitido" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Medico Especialista",
      vigenciaInicio: "2026-02-15",
      vigenciaFin: "2026-08-15",
      importeBruto: "$65,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: {},
      emisionData: {
        numeroDictamen: "03/02/2026",
        fechaDictaminacion: "2026-02-12",
        modalidadFirma: "electronica",
        destinatarios: ["URG-01 Oficina del Secretario", "UEFA Sec. de Salud"],
        firmadoPor: {
          reviso: "Revisor Filtro 1",
          valido: "Revisor Filtro 2",
          emitio: "Director General",
        },
        archivoFirmado: null,
        fechaEmision: "2026-02-12 10:00",
      },
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: "03/02/2026",
      folioDictamenMes: 2,
      folioDictamenAnio: 2026,
      folioDictamenConsecutivo: 3,
      folioDictamenAsignadoPor: "Revisor Filtro 2",
      fechaAsignacionFolioDictamen: "2026-02-06 10:00",
      folioJustificacionConsecutivo: 7,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-008",
      folioSolicitud: "SDTF-2026-0135",
      folioRecepcion: null,
      tipo: "Nombramiento Tiempo Det.",
      tipoAdministracion: "paraestatal",
      secretaria: "Sec. de Educacion",
      unidadAdministrativa: "Dir. Gral. de Administracion y Finanzas",
      estado: "En Validacion Justificaciones",
      fechaCreacion: "2026-02-18",
      fechaRecepcionDO: null,
      slaRestante: null,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-18 09:00", usuario: "Elena Morales", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-18 15:00", usuario: "Elena Morales", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Nombramiento Tiempo Det."),
      denominacion: "Profesor Especializado",
      vigenciaInicio: "2026-04-01",
      vigenciaFin: "2026-07-31",
      importeBruto: "$22,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: {},
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: 8,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-009",
      folioSolicitud: "SDTF-2026-0134",
      folioRecepcion: null,
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Desarrollo",
      unidadAdministrativa: "Dir. Gral. de Recursos Humanos",
      estado: "Observado por Validacion",
      fechaCreacion: "2026-02-15",
      fechaRecepcionDO: null,
      slaRestante: null,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-15 09:00", usuario: "Miguel Hernandez", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-15 11:00", usuario: "Miguel Hernandez", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-17 14:00", usuario: "UEFA Validador", accion: "Observada - Vigencia no coincide con presupuesto", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "Observado por Validacion" },
      ],
      observaciones: ["Vigencia no coincide con periodo presupuestal"],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Consultor de Desarrollo Social",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-12-31",
      importeBruto: "$40,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: {},
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: 9,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-010",
      folioSolicitud: "SDTF-2026-0133",
      folioRecepcion: null,
      tipo: "Nombramiento Tiempo Det.",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Finanzas",
      unidadAdministrativa: "Dir. Gral. de Profesionalizacion",
      estado: "Borrador",
      fechaCreacion: "2026-02-20",
      fechaRecepcionDO: null,
      slaRestante: null,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-20 10:00", usuario: "Admin Usuario", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Nombramiento Tiempo Det."),
      denominacion: "Analista Financiero",
      vigenciaInicio: "2026-04-01",
      vigenciaFin: "2026-09-30",
      importeBruto: "$32,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: {},
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: null,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-011",
      folioSolicitud: "SDTF-2026-0132",
      folioRecepcion: "FE-008",
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "paraestatal",
      secretaria: "Sec. de Gobierno",
      unidadAdministrativa: "Dir. Gral. de Administracion y Finanzas",
      estado: "Observado por Verificacion Final",
      fechaCreacion: "2026-02-03",
      fechaRecepcionDO: "2026-02-05",
      slaRestante: 1,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-03 09:00", usuario: "Diego Ramirez", accion: "Solicitud creada", estadoAnterior: null, estadoNuevo: "Borrador" },
        { fecha: "2026-02-03 14:00", usuario: "Diego Ramirez", accion: "Enviada a UEFA", estadoAnterior: "Borrador", estadoNuevo: "En Validacion Justificaciones" },
        { fecha: "2026-02-04 10:00", usuario: "UEFA Validador", accion: "Validacion aprobada", estadoAnterior: "Enviado a Validacion (UEFA)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-05 08:00", usuario: "DO Recepcion", accion: "Recibida en DO - Folio FE-008", estadoAnterior: "Enviado a DO (Recepcion)", estadoNuevo: "En Revision Revisor" },
        { fecha: "2026-02-07 14:00", usuario: "Revisor Filtro 1", accion: "Aprobada en Filtro 1", estadoAnterior: "En revision DO Filtro 1", estadoNuevo: "En Verificacion Final" },
        { fecha: "2026-02-14 11:00", usuario: "Revisor Filtro 2", accion: "Observada - Importe excede tabulador autorizado", estadoAnterior: "En revision DO Filtro 2", estadoNuevo: "Observado por Verificacion Final" },
      ],
      observaciones: ["Importe excede tabulador autorizado para el nivel indicado"],
      observacionesPorSeccion: [
        { seccion: "Datos Generales", observacion: "Importe excede tabulador autorizado para el nivel indicado" },
      ],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Asesor Juridico",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-06-30",
      importeBruto: "$72,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: 2,
      lastObservedDate: "2026-02-14",
      openedInFiltro: { 1: true, 2: true },
      isNuevaEnFiltro: {},
      emisionData: null,
      esExcepcionDO: false,
      folioRecepcionManual: false,
      esRegularizacion: false,
      folioTemporal: false,
      folioTemporalOriginal: null,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: 10,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
    {
      id: "sol-012",
      folioSolicitud: "SDTF-2026-0131",
      folioRecepcion: "FE-009-1",
      tipo: "Prestacion de Servicios",
      tipoAdministracion: "centralizada",
      secretaria: "Sec. de Desarrollo",
      unidadAdministrativa: "Dir. Gral. de Recursos Humanos",
      estado: "En Revision Revisor",
      fechaCreacion: "2026-02-19",
      fechaRecepcionDO: "2026-02-19",
      slaRestante: 14,
      slaDiasHabiles: 15,
      historial: [
        { fecha: "2026-02-19 10:00", usuario: "DO Recepcion", accion: "Creado como Regularizacion (folio temporal: FE-009-1)", estadoAnterior: null, estadoNuevo: "En Revision Revisor", visibilidadDO: true },
        { fecha: "2026-02-19 10:00", usuario: "DO Recepcion", accion: "Solicitud ingresada por regularizacion extemporanea", estadoAnterior: null, estadoNuevo: "En Revision Revisor" },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist("Prestacion de Servicios"),
      denominacion: "Consultor de Planeacion",
      vigenciaInicio: "2026-03-01",
      vigenciaFin: "2026-08-31",
      importeBruto: "$48,000.00",
      esRenovacion: false,
      folioAnterior: null,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 1: true },
      emisionData: null,
      esExcepcionDO: true,
      folioRecepcionManual: false,
      esRegularizacion: true,
      folioTemporal: true,
      folioTemporalOriginal: "FE-009-1",
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacionConsecutivo: 11,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    },
  ]
}

interface FolioCounter {
  month: number
  year: number
  count: number
}

interface DictamenCounter {
  month: number
  year: number
  count: number
}

interface JustificacionCounter {
  year: number
  count: number
}

interface SolicitudesContextType {
  solicitudes: Solicitud[]
  getSolicitud: (id: string) => Solicitud | undefined
  updateEstado: (id: string, nuevoEstado: Estado, usuario: string, accion: string) => void
  addObservacion: (id: string, observacion: string) => void
  addObservacionSeccion: (id: string, seccion: string, observacion: string) => void
  updateChecklist: (id: string, key: string, value: ChecklistValor, observacion?: string, usuario?: string) => void
  getByFiltro: (filtro: 1 | 2 | 3) => Solicitud[]
  generateFolioRecepcion: () => string
  observarSolicitud: (id: string, observaciones: string[], obsPorSeccion: ObservacionSeccion[], usuario: string, filtro: 1 | 2 | 3) => void
  aprobarFiltro: (id: string, usuario: string, filtro: 1 | 2 | 3) => void
  markOpenedInFiltro: (id: string, filtro: 1 | 2 | 3) => void
  simularReingreso: (id: string) => void
  emitirDictamen: (id: string, fechaDictaminacion: string, modalidadFirma: "electronica" | "autografa", destinatarios: string[], usuario: string, archivoFirmado?: string) => void
  getEmitidos: () => Solicitud[]
  crearExcepcionDO: (data: Omit<Solicitud, "id" | "estado" | "historial" | "observaciones" | "observacionesPorSeccion" | "checklistDO" | "slaRestante" | "reingresoCount" | "lastObservedStage" | "lastObservedDate" | "openedInFiltro" | "isNuevaEnFiltro" | "emisionData" | "marco_normativo" | "riesgo_caidas" | "riesgo_mutilaciones" | "riesgo_golpes" | "riesgo_otros" | "condicion_cambio_domicilio" | "condicion_horario" | "condicion_viajar" | "resguardo_activos" | "folioJustificacion" | "folioJustificacionAnio" | "folioJustificacionConsecutivo" | "folioDictamen" | "folioDictamenMes" | "folioDictamenAnio" | "folioDictamenConsecutivo" | "folioDictamenAsignadoPor" | "fechaAsignacionFolioDictamen">) => void
  crearRegularizacionDO: (data: Omit<Solicitud, "id" | "estado" | "historial" | "observaciones" | "observacionesPorSeccion" | "checklistDO" | "slaRestante" | "reingresoCount" | "lastObservedStage" | "lastObservedDate" | "openedInFiltro" | "isNuevaEnFiltro" | "emisionData" | "folioRecepcion" | "folioRecepcionManual" | "folioTemporal" | "folioTemporalOriginal" | "folioOficializadoPor" | "fechaOficializacion" | "marco_normativo" | "riesgo_caidas" | "riesgo_mutilaciones" | "riesgo_golpes" | "riesgo_otros" | "condicion_cambio_domicilio" | "condicion_horario" | "condicion_viajar" | "resguardo_activos" | "folioJustificacion" | "folioJustificacionAnio" | "folioJustificacionConsecutivo" | "folioDictamen" | "folioDictamenMes" | "folioDictamenAnio" | "folioDictamenConsecutivo" | "folioDictamenAsignadoPor" | "fechaAsignacionFolioDictamen">) => string
  oficializarFolio: (id: string, mesOficial: string, anioOficial: number, consecutivoOficial: number, fechaRecepcionOficial: string, usuario: string) => string | null
  asignarFolioDictamen: (id: string, mes: number, anio: number, consecutivo: number, usuario: string) => string | null
  getNextDictamenConsecutivo: (mes: number, anio: number, excludeId?: string) => number
  enviarAValidacion: (id: string, usuario: string) => string
}

const SolicitudesContext = createContext<SolicitudesContextType | undefined>(undefined)

export function SolicitudesProvider({ children }: { children: ReactNode }) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>(createSeedData)
  const [folioCounter, setFolioCounter] = useState<FolioCounter>({ month: 1, year: 2026, count: 9 })
  const [dictamenCounter, setDictamenCounter] = useState<DictamenCounter>({ month: 1, year: 2026, count: 1 })
  const [justificacionCounter, setJustificacionCounter] = useState<JustificacionCounter>({ year: 2026, count: 11 })

  const getSolicitud = useCallback((id: string) => {
    return solicitudes.find((s) => s.id === id)
  }, [solicitudes])

  const updateEstado = useCallback((id: string, nuevoEstado: Estado, usuario: string, accion: string) => {
    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const entry: HistorialEntry = {
          fecha: new Date().toISOString().replace("T", " ").slice(0, 16),
          usuario,
          accion,
          estadoAnterior: s.estado,
          estadoNuevo: nuevoEstado,
        }
        return { ...s, estado: nuevoEstado, historial: [...s.historial, entry] }
      })
    )
  }, [])

  const addObservacion = useCallback((id: string, observacion: string) => {
    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, observaciones: [...s.observaciones, observacion] } : s
      )
    )
  }, [])

  const addObservacionSeccion = useCallback((id: string, seccion: string, observacion: string) => {
    setSolicitudes((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, observacionesPorSeccion: [...s.observacionesPorSeccion, { seccion, observacion }] }
          : s
      )
    )
  }, [])

  const updateChecklist = useCallback((id: string, key: string, value: ChecklistValor, observacion?: string, usuario?: string) => {
    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const currentItem = s.checklistDO[key] || { valor: null, observacion: "", validadoPor: null, validadoEn: null }
        const now = new Date().toISOString().replace("T", " ").slice(0, 16)
        return {
          ...s,
          checklistDO: {
            ...s.checklistDO,
            [key]: {
              valor: value,
              observacion: observacion !== undefined ? observacion : currentItem.observacion,
              validadoPor: usuario || currentItem.validadoPor,
              validadoEn: value !== null ? now : currentItem.validadoEn,
            },
          },
        }
      })
    )
  }, [])

  const getByFiltro = useCallback((filtro: 1 | 2 | 3) => {
    const estadoEnRevision = `En revision DO Filtro ${filtro}` as Estado
    const estadoObservado = `Observado DO Filtro ${filtro}` as Estado
    return solicitudes.filter((s) => s.estado === estadoEnRevision || s.estado === estadoObservado)
  }, [solicitudes])

  const generateFolioRecepcion = useCallback(() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    let newCount: number

    if (folioCounter.month === month && folioCounter.year === year) {
      newCount = folioCounter.count + 1
    } else {
      newCount = 1
    }

    setFolioCounter({ month, year, count: newCount })
    return `${MONTH_CODES[month]}-${String(newCount).padStart(3, "0")}`
  }, [folioCounter])

  const observarSolicitud = useCallback((id: string, observaciones: string[], obsPorSeccion: ObservacionSeccion[], usuario: string, filtro: 1 | 2 | 3) => {
    const estadoObservado = `Observado DO Filtro ${filtro}` as Estado
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)
    const today = now.slice(0, 10)
    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const entry: HistorialEntry = {
          fecha: now,
          usuario,
          accion: `Observada en Filtro ${filtro}`,
          estadoAnterior: s.estado,
          estadoNuevo: estadoObservado,
        }
        return {
          ...s,
          estado: estadoObservado,
          observaciones: [...s.observaciones, ...observaciones],
          observacionesPorSeccion: [...s.observacionesPorSeccion, ...obsPorSeccion],
          historial: [...s.historial, entry],
          lastObservedStage: filtro,
          lastObservedDate: today,
          isNuevaEnFiltro: { ...s.isNuevaEnFiltro, [filtro]: false },
        }
      })
    )
  }, [])

  const aprobarFiltro = useCallback((id: string, usuario: string, filtro: 1 | 2 | 3) => {
    const nextEstado = filtro < 3
      ? (`En revision DO Filtro ${filtro + 1}` as Estado)
      : ("Aprobado" as Estado)

    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const entry: HistorialEntry = {
          fecha: new Date().toISOString().replace("T", " ").slice(0, 16),
          usuario,
          accion: filtro < 3
            ? `Aprobada en Filtro ${filtro} - Pasa a Filtro ${filtro + 1}`
            : "Aprobada en Filtro 3 (DG) - Solicitud aprobada",
          estadoAnterior: s.estado,
          estadoNuevo: nextEstado,
        }
        const newIsNueva = { ...s.isNuevaEnFiltro }
        if (filtro < 3) {
          newIsNueva[filtro + 1] = true
        }
        return {
          ...s,
          estado: nextEstado,
          slaRestante: filtro === 3 ? null : s.slaRestante,
          historial: [...s.historial, entry],
          isNuevaEnFiltro: newIsNueva,
          checklistDO: filtro < 3 ? createEmptyChecklist(s.tipo) : s.checklistDO,
          openedInFiltro: { ...s.openedInFiltro, [filtro]: true },
        }
      })
    )
  }, [])

  const simularReingreso = useCallback((id: string) => {
    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        if (!s.estado.startsWith("Observado DO Filtro")) return s
        const now = new Date().toISOString().replace("T", " ").slice(0, 16)
        const entryCorreccion: HistorialEntry = {
          fecha: now,
          usuario: "URG Solicitante",
          accion: `Correccion enviada - Reingreso #${s.reingresoCount + 1}`,
          estadoAnterior: s.estado,
          estadoNuevo: "En Revision Revisor",
        }
        return {
          ...s,
          estado: "En revision DO Filtro 1" as Estado,
          reingresoCount: s.reingresoCount + 1,
          historial: [...s.historial, entryCorreccion],
          checklistDO: createEmptyChecklist(s.tipo),
          isNuevaEnFiltro: { 1: false },
          openedInFiltro: {},
        }
      })
    )
  }, [])

  const markOpenedInFiltro = useCallback((id: string, filtro: 1 | 2 | 3) => {
    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        if (s.openedInFiltro[filtro]) return s
        return {
          ...s,
          openedInFiltro: { ...s.openedInFiltro, [filtro]: true },
          isNuevaEnFiltro: { ...s.isNuevaEnFiltro, [filtro]: false },
        }
      })
    )
  }, [])

  const getNextDictamenConsecutivo = useCallback((mes: number, anio: number, excludeId?: string): number => {
    let maxNum = 0
    for (const s of solicitudes) {
      if (excludeId && s.id === excludeId) continue
      if (s.folioDictamenMes === mes && s.folioDictamenAnio === anio && s.folioDictamenConsecutivo !== null) {
        if (s.folioDictamenConsecutivo > maxNum) maxNum = s.folioDictamenConsecutivo
      }
    }
    return maxNum + 1
  }, [solicitudes])

  const asignarFolioDictamen = useCallback((id: string, mes: number, anio: number, consecutivo: number, usuario: string): string | null => {
    const mm = String(mes).padStart(2, "0")
    const folioStr = `${String(consecutivo).padStart(2, "0")}/${mm}/${anio}`

    const duplicate = solicitudes.find(
      (s) => s.folioDictamen === folioStr && s.id !== id
    )
    if (duplicate) return `El folio de dictamen ${folioStr} ya esta asignado a otra solicitud (${duplicate.folioSolicitud})`

    const now = new Date().toISOString().replace("T", " ").slice(0, 16)

    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        return {
          ...s,
          folioDictamen: folioStr,
          folioDictamenMes: mes,
          folioDictamenAnio: anio,
          folioDictamenConsecutivo: consecutivo,
          folioDictamenAsignadoPor: usuario,
          fechaAsignacionFolioDictamen: now,
          historial: [
            ...s.historial,
            {
              fecha: now,
              usuario,
              accion: `Folio de dictamen asignado: ${folioStr}`,
              estadoAnterior: s.estado,
              estadoNuevo: s.estado,
              visibilidadDO: true,
            },
          ],
        }
      })
    )
    return null
  }, [solicitudes])

  const generateNumeroDictamen = useCallback((fechaDictaminacion: string) => {
    const date = new Date(fechaDictaminacion + "T12:00:00")
    const month = date.getMonth()
    const year = date.getFullYear()
    let newCount: number

    if (dictamenCounter.month === month && dictamenCounter.year === year) {
      newCount = dictamenCounter.count + 1
    } else {
      newCount = 1
    }

    setDictamenCounter({ month, year, count: newCount })
    const mm = String(month + 1).padStart(2, "0")
    return `${String(newCount).padStart(2, "0")}/${mm}/${year}`
  }, [dictamenCounter])

  const emitirDictamen = useCallback((
    id: string,
    fechaDictaminacion: string,
    modalidadFirma: "electronica" | "autografa",
    destinatarios: string[],
    usuario: string,
    archivoFirmado?: string,
  ) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)

    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s

        const numeroDictamen = s.folioDictamen || generateNumeroDictamen(fechaDictaminacion)

        const revisoEntry = s.historial.find(h => h.accion.includes("Aprobada en Filtro 1"))
        const validoEntry = s.historial.find(h => h.accion.includes("Aprobada en Filtro 2"))

        const emisionData: EmisionData = {
          numeroDictamen,
          fechaDictaminacion,
          modalidadFirma,
          destinatarios,
          firmadoPor: {
            reviso: revisoEntry?.usuario || "Revisor Filtro 1",
            valido: validoEntry?.usuario || "Revisor Filtro 2",
            emitio: usuario,
          },
          archivoFirmado: archivoFirmado || null,
          fechaEmision: now,
        }

        const historialEntries: HistorialEntry[] = [
          {
            fecha: now,
            usuario,
            accion: `Dictamen emitido - Numero: ${numeroDictamen}`,
            estadoAnterior: s.estado,
            estadoNuevo: "Emitido",
          },
          {
            fecha: now,
            usuario,
            accion: `Destinatarios definidos: ${destinatarios.join(", ")}`,
            estadoAnterior: "Emitido",
            estadoNuevo: "Emitido",
          },
          {
            fecha: now,
            usuario,
            accion: `Firmado ${modalidadFirma === "electronica" ? "electronicamente" : "con firma autografa"}`,
            estadoAnterior: "Emitido",
            estadoNuevo: "Emitido",
          },
          {
            fecha: now,
            usuario: "Sistema",
            accion: "Expediente bloqueado post-emision",
            estadoAnterior: "Emitido",
            estadoNuevo: "Emitido",
          },
        ]

        return {
          ...s,
          estado: "Emitido" as Estado,
          slaRestante: null,
          emisionData,
          historial: [...s.historial, ...historialEntries],
        }
      })
    )
  }, [generateNumeroDictamen])

  const getEmitidos = useCallback(() => {
    return solicitudes.filter((s) => s.estado === "Emitido" && s.emisionData !== null)
  }, [solicitudes])

  const crearExcepcionDO = useCallback((data: Omit<Solicitud, "id" | "estado" | "historial" | "observaciones" | "observacionesPorSeccion" | "checklistDO" | "slaRestante" | "reingresoCount" | "lastObservedStage" | "lastObservedDate" | "openedInFiltro" | "isNuevaEnFiltro" | "emisionData" | "marco_normativo" | "riesgo_caidas" | "riesgo_mutilaciones" | "riesgo_golpes" | "riesgo_otros" | "condicion_cambio_domicilio" | "condicion_horario" | "condicion_viajar" | "resguardo_activos" | "folioJustificacion" | "folioJustificacionAnio" | "folioJustificacionConsecutivo" | "folioDictamen" | "folioDictamenMes" | "folioDictamenAnio" | "folioDictamenConsecutivo" | "folioDictamenAsignadoPor" | "fechaAsignacionFolioDictamen">) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)
    const newId = `sol-${String(solicitudes.length + 1).padStart(3, "0")}`

    const newSol: Solicitud = {
      ...data,
      id: newId,
      estado: "En Revision Revisor",
      historial: [
        {
          fecha: now,
          usuario: "DO Recepcion",
          accion: "Capturada por DO como Excepcion",
          estadoAnterior: null,
          estadoNuevo: "En Revision Revisor",
        },
        {
          fecha: now,
          usuario: "DO Recepcion",
          accion: `Folio manual asignado: ${data.folioRecepcion}`,
          estadoAnterior: "En revision DO Filtro 1",
          estadoNuevo: "En Revision Revisor",
        },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist(data.tipo),
      slaRestante: 15,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 1: true },
      emisionData: null,
      folioDictamen: null,
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacion: null,
      folioJustificacionAnio: null,
      folioJustificacionConsecutivo: null,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
    }

    setSolicitudes((prev) => [...prev, newSol])
  }, [solicitudes.length])

  const crearRegularizacionDO = useCallback((data: Omit<Solicitud, "id" | "estado" | "historial" | "observaciones" | "observacionesPorSeccion" | "checklistDO" | "slaRestante" | "reingresoCount" | "lastObservedStage" | "lastObservedDate" | "openedInFiltro" | "isNuevaEnFiltro" | "emisionData" | "folioRecepcion" | "folioRecepcionManual" | "folioTemporal" | "folioTemporalOriginal" | "folioOficializadoPor" | "fechaOficializacion" | "marco_normativo" | "riesgo_caidas" | "riesgo_mutilaciones" | "riesgo_golpes" | "riesgo_otros" | "condicion_cambio_domicilio" | "condicion_horario" | "condicion_viajar" | "resguardo_activos" | "folioJustificacion" | "folioJustificacionAnio" | "folioJustificacionConsecutivo" | "folioDictamen" | "folioDictamenMes" | "folioDictamenAnio" | "folioDictamenConsecutivo" | "folioDictamenAsignadoPor" | "fechaAsignacionFolioDictamen">) => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)
    const newId = `sol-${String(solicitudes.length + 1).padStart(3, "0")}`
    const tempFolio = generateFolioRecepcion() + "-1"

    const newSol: Solicitud = {
      ...data,
      id: newId,
      folioRecepcion: tempFolio,
      folioRecepcionManual: false,
      estado: "En Revision Revisor",
      historial: [
        {
          fecha: now,
          usuario: "DO Recepcion",
          accion: `Creado como Regularizacion (folio temporal: ${tempFolio})`,
          estadoAnterior: null,
          estadoNuevo: "En Revision Revisor",
          visibilidadDO: true,
        },
        {
          fecha: now,
          usuario: "DO Recepcion",
          accion: "Solicitud ingresada por regularizacion extemporanea",
          estadoAnterior: null,
          estadoNuevo: "En Revision Revisor",
        },
      ],
      observaciones: [],
      observacionesPorSeccion: [],
      checklistDO: createEmptyChecklist(data.tipo),
      slaRestante: 15,
      reingresoCount: 0,
      lastObservedStage: null,
      lastObservedDate: null,
      openedInFiltro: {},
      isNuevaEnFiltro: { 1: true },
      emisionData: null,
      folioTemporal: true,
      folioTemporalOriginal: tempFolio,
      folioOficializadoPor: null,
      fechaOficializacion: null,
      folioDictamen: null,
      marco_normativo: [],
      riesgo_caidas: "Bajo",
      riesgo_mutilaciones: "Bajo",
      riesgo_golpes: "Bajo",
      riesgo_otros: "Bajo",
      condicion_cambio_domicilio: false,
      condicion_horario: false,
      condicion_viajar: false,
      resguardo_activos: "no",
      folioDictamenMes: null,
      folioDictamenAnio: null,
      folioDictamenConsecutivo: null,
      folioDictamenAsignadoPor: null,
      fechaAsignacionFolioDictamen: null,
      folioJustificacion: null,
      folioJustificacionAnio: null,
      folioJustificacionConsecutivo: null,
    }

    setSolicitudes((prev) => [...prev, newSol])
    return tempFolio
  }, [solicitudes.length, generateFolioRecepcion])

  const oficializarFolio = useCallback((id: string, mesOficial: string, anioOficial: number, consecutivoOficial: number, fechaRecepcionOficial: string, usuario: string): string | null => {
    const officialFolio = `${mesOficial}-${String(consecutivoOficial).padStart(3, "0")}`

    const duplicate = solicitudes.find(
      (s) => s.folioRecepcion === officialFolio && s.id !== id
    )
    if (duplicate) return `El folio ${officialFolio} ya esta asignado a otra solicitud (${duplicate.folioSolicitud})`

    const now = new Date().toISOString().replace("T", " ").slice(0, 16)

    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const tempOriginal = s.folioRecepcion
        return {
          ...s,
          folioRecepcion: officialFolio,
          folioTemporal: false,
          folioTemporalOriginal: tempOriginal,
          folioOficializadoPor: usuario,
          fechaOficializacion: now,
          fechaRecepcionDO: fechaRecepcionOficial,
          historial: [
            ...s.historial,
            {
              fecha: now,
              usuario,
              accion: `Folio temporal ${tempOriginal} oficializado como ${officialFolio}`,
              estadoAnterior: s.estado,
              estadoNuevo: s.estado,
              visibilidadDO: true,
            },
            {
              fecha: now,
              usuario,
              accion: `Folio de recepcion oficializado: ${officialFolio} | Fecha de recepcion ajustada: ${fechaRecepcionOficial}`,
              estadoAnterior: s.estado,
              estadoNuevo: s.estado,
            },
          ],
        }
      })
    )
    return null
  }, [solicitudes])

  const generateFolioJustificacion = useCallback(() => {
    const year = new Date().getFullYear()
    let newCount: number

    if (justificacionCounter.year === year) {
      newCount = justificacionCounter.count + 1
    } else {
      newCount = 1
    }

    setJustificacionCounter({ year, count: newCount })
    return {
      folio: `JUST-${year}-${String(newCount).padStart(4, "0")}`,
      anio: year,
      consecutivo: newCount,
    }
  }, [justificacionCounter])

  const enviarAValidacion = useCallback((id: string, usuario: string): string => {
    const now = new Date().toISOString().replace("T", " ").slice(0, 16)
    const { folio, anio, consecutivo } = generateFolioJustificacion()

    setSolicitudes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const justFolio = s.folioJustificacion || folio
        const justAnio = s.folioJustificacionAnio || anio
        const justConsec = s.folioJustificacionConsecutivo || consecutivo

        const entry: HistorialEntry = {
          fecha: now,
          usuario,
          accion: s.folioJustificacion
            ? "Re-enviada a validación UEFA"
            : `Enviada a validación UEFA - Folio de Justificación: ${justFolio}`,
          estadoAnterior: s.estado,
          estadoNuevo: "En Validacion Justificaciones",
        }
        return {
          ...s,
          estado: "Enviado a Validacion (UEFA)" as Estado,
          folioJustificacion: justFolio,
          folioJustificacionAnio: justAnio,
          folioJustificacionConsecutivo: justConsec,
          historial: [...s.historial, entry],
        }
      })
    )
    return folio
  }, [generateFolioJustificacion])

  return (
    <SolicitudesContext.Provider
      value={{
        solicitudes,
        getSolicitud,
        updateEstado,
        addObservacion,
        addObservacionSeccion,
        updateChecklist,
        getByFiltro,
        generateFolioRecepcion,
        observarSolicitud,
        aprobarFiltro,
        markOpenedInFiltro,
        simularReingreso,
        emitirDictamen,
        getEmitidos,
        crearExcepcionDO,
        crearRegularizacionDO,
        oficializarFolio,
        asignarFolioDictamen,
        getNextDictamenConsecutivo,
        enviarAValidacion,
      }}
    >
      {children}
    </SolicitudesContext.Provider>
  )
}

export function useSolicitudes() {
  const ctx = useContext(SolicitudesContext)
  if (!ctx) throw new Error("useSolicitudes must be inside SolicitudesProvider")
  return ctx
}
