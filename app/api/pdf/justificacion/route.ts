import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  PlantillaJustificacionServicios,
  type JustificacionData,
} from "@/components/plantillas/PlantillaJustificacionServicios";
import {
  PlantillaNombramientoDeterminado,
  type JustificacionNombramientoData,
} from "@/components/plantillas/PlantillaNombramientoDeterminado";
import React from "react";

/* ── Helper: Convierte un string separado por comas O saltos de línea en array ── */
function splitToArray(str: string | null | undefined): string[] {
  if (!str || str.trim() === "") return [];
  // Los datos reales vienen separados por comas: "VALOR1, VALOR2, VALOR3"
  // También soporta saltos de línea por si cambia el formato en el futuro
  return str
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/* ── POST /api/pdf/justificacion ── */

// Reutilizable wrapper para ambos métodos (GET y POST)
async function generatePDFResponse(solicitudId: string | null) {
  try {
    if (!solicitudId) {
      return NextResponse.json(
        { ok: false, error: "Falta solicitudId" },
        { status: 400 }
      );
    }

    // Fetch TODOS los campos de la solicitud directamente de Prisma
    const sol = await prisma.solicitud.findUnique({
      where: { id: Number(solicitudId) },
    });

    if (!sol) {
      return NextResponse.json(
        { ok: false, error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    let buffer;

    if (sol.tipo_solicitud === "nombramiento" || (sol.regimen && sol.regimen.toLowerCase().includes("nombramiento"))) {
      const dataNombramiento: JustificacionNombramientoData = {
        tipoAdministracion: (sol as any).tipo_administracion || 'centralizada',
        oficioSolicitud: "",
        secretaria: sol.secretaria ?? "",
        unidadAdministrativa: sol.unidad_administrativa ?? "",
        unidadResponsable: sol.unidad_responsable ?? "",
        programaProyecto: sol.programa_proyecto ?? "",
        denominacionNombramiento: sol.denominacion ?? "",
        tipoActividad: sol.tipo_actividades ?? "",
        puestoJefeInmediato: sol.puesto_jefe_inmediato ?? "",
        numeroPersonas: sol.numero_prestadores ?? 1,
        importeNetoMensual: sol.importe_bruto
          ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
          : "",
        tipoPago: (sol.tipo_importe ?? "").replace(/_/g, " "),
        equivalenciaNivel: `${sol.nivel_tabulador ?? ""} - ${sol.categoria_tabulador ?? ""}`.trim() === "-" ? "" : `${sol.nivel_tabulador ?? ""} ${sol.categoria_tabulador ?? ""}`,
        vigenciaInicio: sol.vigencia_inicio
          ? sol.vigencia_inicio.toISOString().split("T")[0]
          : "",
        vigenciaTermino: sol.vigencia_fin
          ? sol.vigencia_fin.toISOString().split("T")[0]
          : "",
        clavePresupuestal: "",
        renovacion: sol.es_renovacion ?? false,
        folioAnterior: sol.folio_anterior ?? "",

        objetoNombramiento: sol.objeto ?? "",
        funcionesPrincipales: sol.actividades ?? [],
        responsabilidades: sol.responsabilidades ?? [],
        marcoNormativo: sol.marco_normativo ?? [],

        condiciones: {
          cambioDomicilio: sol.condicion_cambio_domicilio ?? false,
          horario: sol.condicion_horario ?? false,
          viajar: sol.condicion_viajar ?? false,
        },
        riesgos: {
          caidas: (sol.riesgo_caidas as "Bajo" | "Medio" | "Alto" | "") || "",
          mutilaciones: (sol.riesgo_mutilaciones as "Bajo" | "Medio" | "Alto" | "") || "",
          golpes: (sol.riesgo_golpes as "Bajo" | "Medio" | "Alto" | "") || "",
          otros: (sol.riesgo_otros as "Bajo" | "Medio" | "Alto" | "") || "",
        },
        resguardoActivos: sol.resguardo_activos === "si",

        perfil: {
          escolaridadMinima: splitToArray(sol.escolaridad),
          competenciasAdministrativas: splitToArray(sol.comp_adm),
          competenciasTecnicas: splitToArray(sol.comp_tec),
          competenciasSociales: splitToArray(sol.comp_soc),
          valores: splitToArray(sol.valores),
          areasExperiencia: splitToArray(sol.areas_exp),
          aniosExperiencia: "",
        },
      };

      buffer = await renderToBuffer(
        React.createElement(PlantillaNombramientoDeterminado as React.FC<any>, { data: dataNombramiento })
      );
    } else {
      // ── Mapeo DIRECTO: campo de Prisma → campo de JustificacionData ──
      const dataHonorarios: JustificacionData = {
        tipoAdministracion: (sol as any).tipo_administracion || 'centralizada', // TODO: Ajustar este mapeo de base de datos según el esquema actual
        secretaria:         sol.secretaria ?? "",
        unidadAdministrativa: sol.unidad_administrativa ?? "",
        unidadResponsable:  sol.unidad_responsable ?? "",
        regimenContratacion: sol.regimen ?? "",
        numeroPrestadores:  sol.numero_prestadores ?? 1,
        programaProyecto:   sol.programa_proyecto ?? "",
        tipoActividades:    sol.tipo_actividades ?? "",
        vigenciaInicio:     sol.vigencia_inicio
          ? sol.vigencia_inicio.toISOString().split("T")[0]
          : "",
        vigenciaTermino:    sol.vigencia_fin
          ? sol.vigencia_fin.toISOString().split("T")[0]
          : "",
        importeBruto:       sol.importe_bruto
          ? `$${Number(sol.importe_bruto).toLocaleString("es-MX", {
              minimumFractionDigits: 2,
            })}`
          : "",
        tipoPago:           (sol.tipo_importe ?? "").replace(/_/g, " "),
        esRenovacion:       sol.es_renovacion ?? false,
        folioAnterior:      sol.folio_anterior ?? "",

        // I.1 Objeto de la contratación — campo de texto libre
        objetoContratacion: sol.objeto ?? "",

        // I.2 Actividades — es String[] en Prisma, se pasa directo
        actividades:        sol.actividades ?? [],

        // I.3 Responsabilidades — es String[] en Prisma, se pasa directo
        responsabilidades:  sol.responsabilidades ?? [],

        // II. Perfil — estos son strings con saltos de línea, se convierten a arrays
        perfil: {
          escolaridadMinima:          splitToArray(sol.escolaridad),
          competenciasAdministrativas: splitToArray(sol.comp_adm),
          competenciasTecnicas:        splitToArray(sol.comp_tec),
          competenciasSociales:        splitToArray(sol.comp_soc),
          valores:                     splitToArray(sol.valores),
          areasExperiencia:            splitToArray(sol.areas_exp),
        },
      };

      buffer = await renderToBuffer(
        React.createElement(PlantillaJustificacionServicios as React.FC<any>, { data: dataHonorarios })
      );
    }

    // Devolver el PDF como archivo descargable
    const folio =
      sol.folio_justificacion ??
      sol.folio_recepcion ??
      String(sol.id);

    const filename = `Justificacion_${folio.replace(/\//g, "-")}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`, // Inline permite visualizarlo en iframes
      },
    });
  } catch (error: unknown) {
    console.error("[GET/POST /api/pdf/justificacion]", error);
    const message =
      error instanceof Error ? error.message : "Error al generar el PDF";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return generatePDFResponse(body.solicitudId);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("id");
  return generatePDFResponse(solicitudId);
}
