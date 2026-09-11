"use client"

import { PageLayout } from "@/components/page-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  FileText, Users, Building2, Target, Layers, KeyRound,
  ClipboardList, Landmark, Factory, ShieldCheck, CheckCircle2, Link2,
} from "lucide-react"

function Section({
  icon: Icon, title, description, children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-card-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="text-sm leading-relaxed text-content-high">
        {children}
      </CardContent>
    </Card>
  )
}

const DIRIGIDO_A = [
  {
    perfil: "Dependencias y entidades (capturistas)",
    uso: "Elaboran sus solicitudes de justificación y les dan seguimiento hasta la emisión del dictamen u opinión",
  },
  {
    perfil: "UEFA de cada dependencia",
    uso: "Valida presupuesto y vigencia de la solicitud antes de enviarla a Desarrollo Organizacional",
  },
  {
    perfil: "Dirección General de Desarrollo Organizacional (DGDO)",
    uso: "Revisa, dictamina y firma electrónicamente cada solicitud en tres filtros secuenciales (Revisor, Verificación Final, Emisor)",
  },
  {
    perfil: "Administradores del sistema",
    uso: "Gestionan el catálogo de dependencias/entidades, usuarios, calendario de periodos y permisos",
  },
  {
    perfil: "Ciudadanía y terceros",
    uso: "Verifican la autenticidad de un documento firmado a través de su liga pública con folio, sin necesidad de cuenta",
  },
]

const JUSTIFICACIONES = [
  { tipo: "Justificación por Honorarios", abrev: "HON" },
  { tipo: "Justificación por Honorarios Asimilados a Salarios", abrev: "HAS" },
  { tipo: "Justificación para Nombramiento por Tiempo Determinado", abrev: "NTD" },
]

const MODULOS = [
  {
    modulo: "Captura y validación",
    alcance: "Alta de solicitudes por dependencia, catálogo de justificaciones y validación presupuestal por UEFA",
  },
  {
    modulo: "Revisión y dictaminación DGDO",
    alcance: "Bandejas de filtro (Revisor, Verificación Final, Emisor), catálogo de dependencias/entidades y calendario de periodos",
  },
  {
    modulo: "Firma electrónica y verificación pública",
    alcance: "Firma electrónica de los firmantes internos, sellado del documento y liga pública de verificación por folio",
  },
  {
    modulo: "Reportes e indicadores",
    alcance: "Tablero informativo con KPIs, gráficas por secretaría/dependencia y exportación a Excel",
  },
]

export function AcercaDePage() {
  return (
    <PageLayout
      title="Acerca de"
      description="Qué es, para qué sirve y cómo está organizado el sistema"
    >
      <div className="max-w-3xl flex flex-col gap-4">

        <Section
          icon={FileText}
          title="Qué es"
        >
          <p>
            <strong>SEDIT</strong> (Sistema de Emisión de Dictaminaciones Técnicas Funcionales) es la
            plataforma digital de la Secretaría de Administración y Finanzas (SAF) del Gobierno del
            Estado de Morelos para tramitar, revisar y emitir las dictaminaciones técnico funcionales
            que sustentan la contratación de prestadores de servicios profesionales por honorarios,
            honorarios asimilados a salarios y nombramientos por tiempo determinado, en las
            dependencias y entidades del Poder Ejecutivo estatal.
          </p>
          <p className="mt-2">
            Sustituye el trámite disperso en oficio y papel por un flujo digital único: captura de la
            solicitud, validación presupuestal, revisión técnica y firma electrónica quedan
            concentradas en un mismo expediente, con folio y bitácora trazable en cada paso.
          </p>
        </Section>

        <Section icon={Target} title="Para qué sirve">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              Da a las dependencias y entidades un lugar único para capturar sus solicitudes de
              justificación y darles seguimiento (<em>Mis solicitudes</em>) hasta su resolución.
            </li>
            <li>
              Da a la UEFA de cada dependencia una bandeja de validación previa —presupuesto y
              vigencia— antes de que la solicitud llegue a Desarrollo Organizacional.
            </li>
            <li>
              Da a la DGDO tres bandejas de revisión secuenciales para dictaminar y firmar
              electrónicamente cada solicitud, con historial completo de movimientos.
            </li>
            <li>
              Permite verificar la autenticidad de cualquier documento emitido mediante una liga
              pública con folio, sin necesidad de cuenta.
            </li>
          </ul>
        </Section>

        <Section icon={Users} title="A quién está dirigido">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead>Uso que le da al sistema</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DIRIGIDO_A.map((row) => (
                <TableRow key={row.perfil}>
                  <TableCell className="font-medium">{row.perfil}</TableCell>
                  <TableCell>{row.uso}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section
          icon={ClipboardList}
          title="Justificaciones que gestiona"
          description="Tipos de solicitud que puede capturar una dependencia"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de justificación</TableHead>
                <TableHead>Abreviatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {JUSTIFICACIONES.map((row) => (
                <TableRow key={row.abrev}>
                  <TableCell className="font-medium">{row.tipo}</TableCell>
                  <TableCell><Badge variant="outline">{row.abrev}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section icon={ShieldCheck} title="Cómo fluye una solicitud">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>La dependencia captura la solicitud y la envía a validación.</li>
            <li>La UEFA valida presupuesto y vigencia; puede aprobar o devolver con observaciones.</li>
            <li>
              La DGDO la revisa en tres filtros (Revisor → Verificación Final → Emisor) y emite el
              dictamen técnico funcional (Administración Centralizada) o la opinión técnico funcional
              (Administración Paraestatal).
            </li>
            <li>
              El documento se firma electrónicamente por los firmantes internos que intervinieron y
              queda disponible con folio en una liga pública de verificación.
            </li>
          </ol>
          <p className="mt-2 text-content-low">
            Cada solicitud conserva su bitácora completa —estados, fechas y usuarios que
            intervinieron— consultable en su historial.
          </p>
        </Section>

        <Section icon={Building2} title="Alcance">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Landmark className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-card-foreground">Administración Pública Centralizada</p>
                <p className="text-content-low text-xs mt-0.5">Dependencias — se resuelven mediante Dictamen Técnico Funcional</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <Factory className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-card-foreground">Administración Pública Paraestatal</p>
                <p className="text-content-low text-xs mt-0.5">Entidades y organismos auxiliares — se resuelven mediante Opinión Técnico Funcional</p>
              </div>
            </div>
          </div>
        </Section>

        <Section icon={Layers} title="Encaje institucional">
          <p>
            SEDIT pertenece a la Secretaría de Administración y Finanzas (SAF). El área operativa
            responsable de la revisión y dictaminación de las solicitudes es la Dirección General de
            Desarrollo Organizacional (DGDO).
          </p>
        </Section>

        <Section icon={Target} title="Meta institucional">
          <p>
            Reducir el tiempo entre la solicitud de una dependencia o entidad y la emisión de su
            dictamen u opinión técnico funcional, sustituyendo el trámite documental disperso por un
            flujo digital único, trazable y verificable.
          </p>
        </Section>

        <Section icon={CheckCircle2} title="Módulos del sistema">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Alcance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULOS.map((row) => (
                <TableRow key={row.modulo}>
                  <TableCell className="font-medium">{row.modulo}</TableCell>
                  <TableCell>{row.alcance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section icon={KeyRound} title="Acceso">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Portal del sistema: acceso restringido mediante usuario (RFC) y contraseña.</li>
            <li>
              Verificación pública de documentos firmados: consulta abierta mediante folio o liga
              directa, sin necesidad de cuenta.
            </li>
          </ul>
        </Section>

        <p className="flex items-center gap-1.5 text-xs text-content-low pt-1">
          <Link2 className="h-3.5 w-3.5" />
          Gobierno del Estado de Morelos · Secretaría de Administración y Finanzas
        </p>
      </div>
    </PageLayout>
  )
}
