import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

type Categoria = { nombre: string; orden: number; organos: string[] }

export const PARAESTATALES: Categoria[] = [
  {
    nombre: "Secretaría de Gobierno",
    orden: 1,
    organos: [
      "Instituto Estatal Pro-Veteranos de la Revolución del Sur",
      "Instituto de Servicios Registrales y Catastrales del Estado de Morelos (ISRyC)",
      "Comisión Ejecutiva de Atención y Reparación a Víctimas (CEARV)",
      "Instituto de la Defensoría Pública del Estado de Morelos (IDEPEM)",
      "Coordinación Estatal de Protección Civil Morelos (CEPCM)",
    ],
  },
  {
    nombre: "Secretaría de Administración y Finanzas",
    orden: 2,
    organos: [
      "Instituto de Crédito para los Trabajadores al Servicio del Gobierno del Estado de Morelos (ICTSGEM)",
      "Fondo Estatal Para la promocion y desarrollo de eventos vinculados con la cultura y el turismo",
    ],
  },
  {
    nombre: "Secretaría de Desarrollo Económico y del Trabajo",
    orden: 3,
    organos: [
      "Instituto Morelense para el Financiamiento del Sector Productivo (Fondo Morelos)",
      "Consejo de Ciencia y Tecnología del Estado de Morelos (CCyTEM)",
      "Centro de Conciliación Laboral del Estado de Morelos",
      "Fideicomiso del Fondo de Desarrollo Empresarial y Promoción de la Inversión (FIFODEPI)",
      "Fideicomiso Parque Científico y Tecnológico Morelos",
      "Fideicomiso del Fondo de Competitividad y Promoción del Empleo (FIDECOMP)",
      "Aeropuerto de Cuernavaca, S.A. de C.V.",
    ],
  },
  {
    nombre: "Secretaría de Desarrollo Agropecuario",
    orden: 4,
    organos: [
      "Fondo de Fomento Agropecuario (FOFAE)",
      "Fideicomiso de Impulso Financiero al Campo Morelense (FIFOCAM)",
    ],
  },
  {
    nombre: "Secretaría de Infraestructura",
    orden: 5,
    organos: [
      "Instituto Estatal de Infraestructura Educativa de Morelos (INEIEM)",
    ],
  },
  {
    nombre: "Secretaría de Educación",
    orden: 6,
    organos: [
      "Instituto de Capacitación para el Trabajo del Estado de Morelos (ICATMOR)",
      "Instituto de la Educación Básica del Estado de Morelos (IEBEM)",
      "Instituto Estatal de Educación para Adultos (INEEA)",
      "Colegio de Bachilleres del Estado de Morelos (COBAEM)",
      "Colegio de Educación Profesional Técnica del Estado de Morelos (CONALEP Morelos)",
      "Colegio de Estudios Científicos y Tecnológicos del Estado de Morelos (CECyTE)",
      "Centro Morelense de las Artes (CEMA)",
      "Universidad Tecnológica Emiliano Zapata del Estado de Morelos (UTEZ)",
      "Universidad Tecnológica del Sur del Estado de Morelos (UTSEM)",
      "Universidad Politécnica del Estado de Morelos (UPEMOR)",
    ],
  },
  {
    nombre: "Secretaría de Salud",
    orden: 7,
    organos: [
      "Servicios de Salud de Morelos (SSM)",
      "Hospital del Niño Morelense",
      "Comisión Estatal de Arbitraje Médico del Estado de Morelos (COESAMOR)",
      "Sistema para el Desarrollo Integral de la Familia del Estado de Morelos (DIF Morelos)",
    ],
  },
  {
    nombre: "Secretaría de Turismo",
    orden: 8,
    organos: [
      "Fideicomiso Centro de Congresos y Convenciones Morelos",
      "Fideicomiso Turismo Morelos (FITUR)",
    ],
  },
  {
    nombre: "Secretaría de Cultura",
    orden: 9,
    organos: [
      "Museo Morelense de Arte Popular (MMAPO)",
      "Instituto Morelense de Radio y Televisión (IMRyT)",
      "Museo Morelense de Arte Contemporáneo Juan Soriano (MMAC)",
      "Auditorio Cultural Teopanzolco",
    ],
  },
  {
    nombre: "Secretaría de Desarrollo Sustentable",
    orden: 10,
    organos: [
      "Comisión Estatal del Agua (CEAGUA)",
      "Comisión Estatal de Reservas Territoriales (CERT)",
      "Fideicomiso Lago de Tequesquitengo (FILATEQ)",
    ],
  },
  {
    nombre: "Secretaría de Bienestar",
    orden: 11,
    organos: [
      "Instituto Morelense de Estudio de la Familia",
      "Instituto del Deporte y Cultura Física del Estado de Morelos (INDEM)",
      "Secretaría Ejecutiva del Sistema Estatal Anticorrupción",
      "Instituto de Vivienda del Estado de Morelos (INVIMOR)",
    ],
  },
]

export async function seedParaestatales(prisma: PrismaClient) {
  await prisma.organo_paraestatal.deleteMany({})
  await prisma.categoria_paraestatal.deleteMany({})
  console.log("paraestatales limpiado")

  let total = 0
  for (const cat of PARAESTATALES) {
    const c = await prisma.categoria_paraestatal.create({
      data: { nombre: cat.nombre, orden: cat.orden },
    })
    for (let i = 0; i < cat.organos.length; i++) {
      await prisma.organo_paraestatal.create({
        data: {
          nombre: cat.organos[i],
          orden: i,
          categoria_id: c.id,
        },
      })
      total++
    }
  }
  console.log(`Categorías: ${PARAESTATALES.length}, Paraestatales: ${total}`)
}

if (isMain(import.meta.url)) {
  runStandalone("paraestatales", seedParaestatales)
}
