import type { PrismaClient } from "../../lib/generated/prisma"
import { isMain, runStandalone } from "./_runner"

type Unidad = { nombre: string; clave: string }
type Secretaria = { nombre: string; orden: number; unidades: Unidad[] }

const c = (raw: string) => raw.trim().split(/\s+/).join(".")

export const CENTRALIZADAS: Secretaria[] = [
  {
    nombre: "Jefatura de la Oficina de la Gubernatura del Estado",
    orden: 1,
    unidades: [
      { nombre: "Jefatura de la Oficina de la Gubernatura del Estado", clave: c("1 01 1 0 0 0 0") },
      { nombre: "Secretaría Privada de la Persona Titular del Poder Ejecutivo Estatal", clave: c("1 01 3 0 0 0 0") },
      { nombre: "Coordinación de Asesores de la Gubernatura", clave: c("1 01 4 0 0 0 0") },
      { nombre: "Secretaría Particular de la Jefatura", clave: c("1 01 9 0 0 0 0") },
      { nombre: "Dirección General de Residencias Oficiales", clave: c("1 01 10 0 0 0 0") },
      { nombre: "Dirección General de Relaciones Públicas", clave: c("1 01 11 0 0 0 0") },
      { nombre: "Dirección General de Logística y Eventos", clave: c("1 01 12 0 0 0 0") },
      { nombre: "Dirección General de Análisis Estratégico", clave: c("1 01 13 0 0 0 0") },
      { nombre: "Dirección General de Coordinación y Vinculación", clave: c("1 01 14 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Jefatura de la Oficina de la Gubernatura del Estado", clave: c("1 01 21 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Jefatura de la Oficina de la Gubernatura del Estado", clave: c("1 01 22 0 0 0 0") },
      { nombre: "Representación del Poder Ejecutivo de Morelos en la CDMX", clave: c("1 02 2 0 0 0 0") },
      { nombre: "Dirección General de Relaciones Internacionales", clave: c("1 02 7 0 0 0 0") },
      { nombre: "Dirección General de Migrantes", clave: c("1 02 8 0 0 0 0") },
      { nombre: "Coordinación de Comunicación Social", clave: c("1 03 6 0 0 0 0") },
      { nombre: "Dirección General de Imagen y Material Audiovisual", clave: c("1 03 15 0 0 0 0") },
      { nombre: "Dirección General de Comunicación", clave: c("1 03 16 0 0 0 0") },
      { nombre: "Dirección General de Redes Sociales", clave: c("1 03 17 0 0 0 0") },
      { nombre: "Coordinación de la Agencia de Transformación Digital", clave: c("1 04 5 0 0 0 0") },
      { nombre: "Dirección General de Gobierno Digital", clave: c("1 04 18 0 0 0 0") },
      { nombre: "Dirección General de Gobernanza y Operación Tecnológica", clave: c("1 04 19 0 0 0 0") },
      { nombre: "Dirección General de Gobernanza y Observatorio de Datos", clave: c("1 04 20 0 0 0 0") },
      { nombre: "Hábitat Morelos", clave: c("1 40 23 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Gobierno",
    orden: 2,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Gobierno", clave: c("2 01 1 0 0 0 0") },
      { nombre: "Subsecretaría de Gobierno", clave: c("2 01 2 0 0 0 0") },
      { nombre: "Dirección General de Atención a Municipios", clave: c("2 01 7 0 0 0 0") },
      { nombre: "Dirección General de Registro Civil", clave: c("2 01 8 0 0 0 0") },
      { nombre: "Dirección General de Derechos Humanos", clave: c("2 01 10 0 0 0 0") },
      { nombre: "Dirección General Jurídica", clave: c("2 01 12 0 0 0 0") },
      { nombre: "Dirección General de Vinculación Operativa y de Gestión", clave: c("2 01 13 0 0 0 0") },
      { nombre: "Dirección General de Gobierno", clave: c("2 02 5 0 0 0 0") },
      { nombre: "Dirección General de Atención Ciudadana", clave: c("2 02 6 0 0 0 0") },
      { nombre: "Instituto Estatal de Documentación de Morelos", clave: c("2 40 14 0 0 0 0") },
      { nombre: "Secretaría Ejecutiva del Sistema de Protección Integral de Niñas, Niños y Adolescentes del Estado de Morelos", clave: c("2 40 15 0 0 0 0") },
      { nombre: "Comisión de Búsqueda de Personas del Estado de Morelos", clave: c("2 40 16 0 0 0 0") },
      { nombre: "Comisión Ejecutiva para Prevenir y Erradicar la Violencia contra las Mujeres del Poder Ejecutivo del Estado de Morelos", clave: c("2 40 17 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Administración y Finanzas",
    orden: 3,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Administración y Finanzas", clave: c("3 01 1 0 0 0 0") },
      { nombre: "Dirección General de Gestión Administrativa", clave: c("3 01 9 0 0 0 0") },
      { nombre: "Coordinación Técnica", clave: c("3 02 2 0 0 0 0") },
      { nombre: "Dirección General de Sistemas y Armonización Contable", clave: c("3 02 10 0 0 0 0") },
      { nombre: "Subsecretaría de Administración", clave: c("3 03 3 0 0 0 0") },
      { nombre: "Dirección General de Recursos Humanos", clave: c("3 03 11 0 0 0 0") },
      { nombre: "Dirección General de Contrataciones de Bienes y Servicios", clave: c("3 03 12 0 0 0 0") },
      { nombre: "Dirección General de Patrimonio", clave: c("3 03 13 0 0 0 0") },
      { nombre: "Dirección General de Desarrollo Organizacional", clave: c("3 03 14 0 0 0 0") },
      { nombre: "Dirección General de Servicios", clave: c("3 03 15 0 0 0 0") },
      { nombre: "Subsecretaría de Ingresos", clave: c("3 04 4 0 0 0 0") },
      { nombre: "Dirección General de Auditoría Fiscal", clave: c("3 04 17 0 0 0 0") },
      { nombre: "Dirección General de Coordinación Hacendaria", clave: c("3 04 18 0 0 0 0") },
      { nombre: "Subsecretaría de Egresos", clave: c("3 05 5 0 0 0 0") },
      { nombre: "Dirección General de Presupuesto y Gasto Público", clave: c("3 05 19 0 0 0 0") },
      { nombre: "Dirección General de Contabilidad Gubernamental", clave: c("3 05 20 0 0 0 0") },
      { nombre: "Dirección General de Inversión", clave: c("3 05 21 0 0 0 0") },
      { nombre: "Dirección General de Coordinación de Programas Federales", clave: c("3 05 22 0 0 0 0") },
      { nombre: "Tesorería General", clave: c("3 06 6 0 0 0 0") },
      { nombre: "Dirección General de Caja y Control Financiero", clave: c("3 06 23 0 0 0 0") },
      { nombre: "Procuraduría Fiscal", clave: c("3 07 7 0 0 0 0") },
      { nombre: "Subprocuraduría de lo Contencioso", clave: c("3 07 25 0 0 0 0") },
      { nombre: "Subprocuraduría de Recursos y Procedimientos Administrativos", clave: c("3 07 26 0 0 0 0") },
      { nombre: "Unidad de Planeación", clave: c("3 08 8 0 0 0 0") },
      { nombre: "Dirección General de Planeación Participativa e Información Estratégica", clave: c("3 08 27 0 0 0 0") },
      { nombre: "Dirección General de Seguimiento y Evaluación", clave: c("3 08 28 0 0 0 0") },
      { nombre: "Unidad de Inteligencia Patrimonial y Económica del Estado de Morelos", clave: c("3 40 29 0 0 0 0") },
      { nombre: "Fondo Estatal para la Promoción y Desarrollo de Eventos Vinculados con la Cultura y el Turismo", clave: c("3 40 30 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Desarrollo Económico y del Trabajo",
    orden: 4,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Desarrollo Económico y del Trabajo", clave: c("4 01 1 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Desarrollo Económico y del Trabajo", clave: c("4 01 13 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Desarrollo Económico y del Trabajo", clave: c("4 01 14 0 0 0 0") },
      { nombre: "Subsecretaría de Desarrollo Económico", clave: c("4 02 3 0 0 0 0") },
      { nombre: 'Dirección General de "Orgullo Morelos"', clave: c("4 02 6 0 0 0 0") },
      { nombre: "Dirección General de Macroeconomía y Fomento a la Exportación", clave: c("4 02 7 0 0 0 0") },
      { nombre: "Dirección General de MIPyMES", clave: c("4 02 8 0 0 0 0") },
      { nombre: "Dirección General de la Economía y el Emprendimiento para el Bienestar", clave: c("4 02 9 0 0 0 0") },
      { nombre: "Subsecretaría del Trabajo y Previsión Social", clave: c("4 03 4 0 0 0 0") },
      { nombre: "Dirección General de Inspección del Trabajo", clave: c("4 03 10 0 0 0 0") },
      { nombre: "Dirección General del Servicio Nacional de Empleo Morelos", clave: c("4 03 11 0 0 0 0") },
      { nombre: "Procuraduría Estatal de la Defensa del Trabajo", clave: c("4 03 12 0 0 0 0") },
      { nombre: "Subsecretaría de Inversiones Estratégicas", clave: c("4 04 5 0 0 0 0") },
      { nombre: "Junta Local de Conciliación y Arbitraje del Estado de Morelos", clave: c("4 40 15 0 0 0 0") },
      { nombre: "Tribunal Estatal de Conciliación y Arbitraje del Estado de Morelos", clave: c("4 40 16 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Desarrollo Agropecuario",
    orden: 5,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Desarrollo Agropecuario", clave: c("5 01 1 0 0 0 0") },
      { nombre: "Dirección General de Agricultura y Agroecología", clave: c("5 01 2 0 0 0 0") },
      { nombre: "Dirección General de Ganadería y Acuacultura", clave: c("5 01 3 0 0 0 0") },
      { nombre: "Dirección General de Impulso Agropecuario", clave: c("5 01 4 0 0 0 0") },
      { nombre: "Dirección General de Planeación y Apoyo Técnico", clave: c("5 01 5 0 0 0 0") },
      { nombre: "Dirección General de Innovación y Competitividad", clave: c("5 01 6 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Desarrollo Agropecuario", clave: c("5 01 7 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Desarrollo Agropecuario", clave: c("5 01 8 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Infraestructura",
    orden: 6,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Infraestructura", clave: c("6 01 1 0 0 0 0") },
      { nombre: "Dirección General de Obras Públicas", clave: c("6 01 2 0 0 0 0") },
      { nombre: "Dirección General de Caminos y Puentes", clave: c("6 01 3 0 0 0 0") },
      { nombre: "Dirección General de Obra Educativa", clave: c("6 01 4 0 0 0 0") },
      { nombre: "Dirección General de Proyectos", clave: c("6 01 5 0 0 0 0") },
      { nombre: "Dirección General de Licitaciones y Contratación de Obra Pública", clave: c("6 01 6 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Infraestructura", clave: c("6 01 7 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Infraestructura", clave: c("6 01 8 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Educación",
    orden: 7,
    unidades: [
      { nombre: "Oficina del Secretario", clave: c("7 01 1 0 0 0 0") },
      { nombre: "Secretaría Técnica", clave: c("7 01 2 0 0 0 0") },
      { nombre: "Dirección General de Educación Media Superior y Superior", clave: c("7 01 3 0 0 0 0") },
      { nombre: "Dirección General de Vinculación y Enlace", clave: c("7 01 4 0 0 0 0") },
      { nombre: "Dirección General de Proyectos de Inversión", clave: c("7 01 5 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Educación", clave: c("7 01 6 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Educación", clave: c("7 01 7 0 0 0 0") },
      { nombre: "Coordinación Estatal del Subsistema de Preparatoria Abierta", clave: c("7 40 8 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Salud",
    orden: 8,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Salud", clave: c("8 01 1 0 0 0 0") },
      { nombre: "Secretaría Técnica", clave: c("8 01 2 1 0 0 0") },
      { nombre: "Dirección General de Proyectos y Políticas Públicas en Salud", clave: c("8 01 3 0 0 0 0") },
      { nombre: "Dirección General de Coordinación y Supervisión", clave: c("8 01 4 0 0 0 0") },
      { nombre: "Dirección General de Vinculación y Participación Social", clave: c("8 01 5 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Salud", clave: c("8 01 6 0 1 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Salud", clave: c("8 01 7 0 2 0 0") },
    ],
  },
  {
    nombre: "Secretaría Anticorrupción y Buen Gobierno",
    orden: 10,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de la Contraloría", clave: c("10 01 1 0 0 0 0") },
      { nombre: "Secretaría Técnica", clave: c("10 01 2 0 0 0 0") },
      { nombre: "Dirección General de Responsabilidades", clave: c("10 01 8 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Contraloría", clave: c("10 01 10 0 0 0 0") },
      { nombre: "Subsecretaría de Fiscalización y Combate a la Corrupción", clave: c("10 02 3 0 0 0 0") },
      { nombre: "Dirección General de Auditoría Gubernamental", clave: c("10 02 5 0 0 0 0") },
      { nombre: "Dirección General de Mejora Gubernamental y Contraloría Social", clave: c("10 02 6 0 0 0 0") },
      { nombre: "Dirección General de Quejas, Denuncias e Investigaciones", clave: c("10 02 7 0 0 0 0") },
      { nombre: "Unidad de Órganos de Vigilancia", clave: c("10 03 4 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Turismo",
    orden: 11,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Turismo", clave: c("11 01 1 0 0 0 0") },
      { nombre: "Secretaría Técnica", clave: c("11 01 2 0 0 0 0") },
      { nombre: "Dirección General de Desarrollo de Productos Turísticos", clave: c("11 01 3 0 0 0 0") },
      { nombre: "Dirección General de Competitividad y Servicios Turísticos", clave: c("11 01 4 0 0 0 0") },
      { nombre: "Dirección General de la Comisión de Filmaciones", clave: c("11 01 5 0 0 0 0") },
      { nombre: "Dirección General de Turismo Comunitario", clave: c("11 01 6 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Turismo", clave: c("11 01 7 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Turismo", clave: c("11 01 8 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Cultura",
    orden: 12,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Cultura", clave: c("12 01 1 0 0 0 0") },
      { nombre: "Secretaría Técnica", clave: c("12 01 2 0 0 0 0") },
      { nombre: "Dirección General de Museos y Exposiciones", clave: c("12 01 3 0 0 0 0") },
      { nombre: "Dirección General de Desarrollo Cultural Comunitario", clave: c("12 01 4 0 0 0 0") },
      { nombre: "Dirección General de Publicaciones y Fomento a la Lectura", clave: c("12 01 5 0 0 0 0") },
      { nombre: "Dirección General de Fomento a las Artes", clave: c("12 01 6 0 0 0 0") },
      { nombre: "Dirección General de Formación de las Artes y la Cultura", clave: c("12 01 7 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Cultura", clave: c("12 01 8 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Cultura", clave: c("12 01 9 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Bienestar",
    orden: 13,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Bienestar", clave: c("13 01 1 0 0 0 0") },
      { nombre: "Dirección General de Construcción de Paz", clave: c("13 01 2 0 0 0 0") },
      { nombre: "Dirección General de Programas, Proyectos Especiales y Coordinación Interinstitucional", clave: c("13 01 3 0 0 0 0") },
      { nombre: "Dirección General de Comunidades de Atención Prioritaria e Inclusión", clave: c("13 01 4 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de Bienestar", clave: c("13 01 5 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de Bienestar", clave: c("13 01 6 0 0 0 0") },
      { nombre: "Comisión Estatal de Evaluación del Desarrollo Social", clave: c("13 40 7 0 0 0 0") },
      { nombre: "Instituto Morelense de las Personas Adolescentes y Jóvenes", clave: c("13 40 8 0 0 0 0") },
      { nombre: "Instituto de los Pueblos y Comunidades Indígenas y Afromexicanas de Morelos", clave: c("13 40 9 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Desarrollo Sustentable",
    orden: 14,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de Desarrollo Sustentable", clave: c("14 01 1 0 0 0 0") },
      { nombre: "Dirección General de Ordenamiento Territorial", clave: c("14 01 2 0 0 0 0") },
      { nombre: "Dirección General de Gestión Ambiental", clave: c("14 01 3 0 0 0 0") },
      { nombre: "Dirección General de Educación Ambiental y Vinculación Estratégica", clave: c("14 01 4 0 0 0 0") },
      { nombre: "Dirección General de Áreas Naturales Protegidas", clave: c("14 01 5 0 0 0 0") },
      { nombre: "Dirección General de Mejoramiento Ecosistémico y Cambio Climático", clave: c("14 01 6 0 0 0 0") },
      { nombre: "Dirección General de Consultoría, Asuntos Jurídicos y Normatividad", clave: c("14 01 7 0 0 0 0") },
      { nombre: "Dirección General de Proyectos y Gestión Administrativa", clave: c("14 01 8 0 0 0 0") },
      { nombre: "Comisión Estatal de Biodiversidad", clave: c("14 40 10 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de las Mujeres",
    orden: 15,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Secretaría de las Mujeres", clave: c("15 01 1 0 0 0 0") },
      { nombre: "Secretaría Técnica", clave: c("15 01 2 0 0 0 0") },
      { nombre: "Dirección General de Programas y Desarrollo Integral de las Mujeres", clave: c("15 01 3 0 0 0 0") },
      { nombre: "Unidad de Enlace Jurídico de la Secretaría de las Mujeres", clave: c("15 01 4 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Secretaría de las Mujeres", clave: c("15 01 5 0 0 0 0") },
    ],
  },
  {
    nombre: "Secretaría de Seguridad y Protección Ciudadana",
    orden: 16,
    unidades: [
      { nombre: "Oficina del Secretario", clave: c("16 01 1 0 0 0 0") },
      { nombre: "Dirección General del Centro Estatal de Análisis de Información sobre Seguridad Pública", clave: c("16 01 15 0 0 0 0") },
      { nombre: "Dirección General del C5", clave: c("16 01 16 0 0 0 0") },
      { nombre: "Dirección General de la Ayudantía de la Gobernadora", clave: c("16 01 17 0 0 0 0") },
      { nombre: "Dirección General de Seguridad Privada", clave: c("16 01 18 0 0 0 0") },
      { nombre: "Dirección General Jurídica", clave: c("16 01 19 0 0 0 0") },
      { nombre: "Dirección General de la Policía Industrial, Bancaria y Auxiliar", clave: c("16 01 20 0 0 0 0") },
      { nombre: "Dirección General de la Academia Estatal de Estudios Superiores en Seguridad", clave: c("16 01 21 0 0 0 0") },
      { nombre: "Dirección General de Asuntos Internos", clave: c("16 01 22 0 0 0 0") },
      { nombre: "Dirección General de Inteligencia Policial", clave: c("16 01 23 0 0 0 0") },
      { nombre: "Subsecretaría Operativa de Seguridad Pública", clave: c("16 02 2 0 0 0 0") },
      { nombre: "Dirección General de Logística Operativa", clave: c("16 02 3 0 0 0 0") },
      { nombre: "Dirección General de la Policía Preventiva Estatal", clave: c("16 02 4 0 0 0 0") },
      { nombre: "Dirección General de Unidades Especiales", clave: c("16 02 5 0 0 0 0") },
      { nombre: "Coordinación del Sistema Penitenciario", clave: c("16 03 6 0 0 0 0") },
      { nombre: "Dirección General de Reinserción Social", clave: c("16 03 7 0 0 0 0") },
      { nombre: "Dirección General de Centros Penitenciarios", clave: c("16 03 8 0 0 0 0") },
      { nombre: "Dirección General de Ejecución de Medidas para Adolescentes", clave: c("16 03 9 0 0 0 0") },
      { nombre: "Dirección General Operativa Penitenciaria", clave: c("16 03 10 0 0 0 0") },
      { nombre: "Coordinación de Desarrollo y Fortalecimiento Institucional", clave: c("16 04 11 0 0 0 0") },
      { nombre: "Dirección General de Prestación de Servicios de Personal Operativo", clave: c("16 04 12 0 0 0 0") },
      { nombre: "Dirección General de Control de Gasto Operativo", clave: c("16 04 14 0 0 0 0") },
      { nombre: "Centro Estatal de Prevención Social de la Violencia y la Delincuencia con Participación Ciudadana", clave: c("16 40 24 0 0 0 0") },
      { nombre: "Secretariado Ejecutivo del Sistema Estatal de Seguridad Pública", clave: c("16 40 25 0 0 0 0") },
    ],
  },
  {
    nombre: "Consejería Jurídica",
    orden: 17,
    unidades: [
      { nombre: "Oficina de la Persona Titular de la Consejería Jurídica", clave: c("17 01 1 0 0 0 0") },
      { nombre: "Coordinación Ejecutiva", clave: c("17 01 2 0 0 0 0") },
      { nombre: "Secretaría Ejecutiva", clave: c("17 01 3 0 0 0 0") },
      { nombre: "Dirección General de Asuntos Burocráticos", clave: c("17 01 4 0 0 0 0") },
      { nombre: "Dirección General de Asuntos Contenciosos", clave: c("17 01 5 0 0 0 0") },
      { nombre: "Dirección General de Consultoría de Asuntos Administrativos", clave: c("17 01 6 0 0 0 0") },
      { nombre: "Dirección General de Asuntos Constitucionales y Amparo", clave: c("17 01 7 0 0 0 0") },
      { nombre: "Dirección General de Legislación", clave: c("17 01 8 0 0 0 0") },
      { nombre: "Unidad de Enlace Financiero Administrativo de la Consejería Jurídica", clave: c("17 01 9 0 0 0 0") },
    ],
  },
]

export async function seedSecretarias(prisma: PrismaClient) {
  // GUARDIA DE SEGURIDAD: este seed es destructivo (recrea organo_centralizado con IDs
  // nuevos). Si la tabla ya tiene datos, NO se ejecuta, para no dejar huérfanos los
  // secretaria_id de los usuarios (lo que los haría verse como "paraestatal").
  // El poblado/actualización sobre una base con datos debe hacerse con una migración
  // o un script idempotente, nunca borrando aquí.
  const yaHayOrganos = await prisma.organo_centralizado.count()
  if (yaHayOrganos > 0) {
    console.log(`organo_centralizado ya tiene ${yaHayOrganos} registros — seed de secretarías OMITIDO (evita borrar datos)`)
    return
  }

  let totalUnidades = 0
  for (const sec of CENTRALIZADAS) {
    const padre = await prisma.organo_centralizado.create({
      data: {
        nombre: sec.nombre,
        orden: sec.orden,
        tipo: "SECRETARIA",
        parent_id: null,
      },
    })
    for (let i = 0; i < sec.unidades.length; i++) {
      const u = sec.unidades[i]
      await prisma.organo_centralizado.create({
        data: {
          nombre: u.nombre,
          orden: i,
          tipo: null,
          parent_id: padre.id,
          ua_clave_administrativa: u.clave,
        },
      })
      totalUnidades++
    }
  }
  console.log(`Secretarías: ${CENTRALIZADAS.length}, Unidades: ${totalUnidades}`)
}

if (isMain(import.meta.url)) {
  runStandalone("secretarias", seedSecretarias)
}
