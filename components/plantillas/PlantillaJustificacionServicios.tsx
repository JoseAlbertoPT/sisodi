import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import path from "path";
import React from "react";

/* ═══════════════════════════════════════════════════════════
   INTERFACE EXACTA DE TUS DATOS
   ═══════════════════════════════════════════════════════════ */
export interface JustificacionData {
  tipoAdministracion: 'centralizada' | 'paraestatal';
  secretaria: string;
  unidadAdministrativa: string;
  unidadResponsable: string;
  regimenContratacion: string;
  numeroPrestadores: number;
  programaProyecto: string;
  tipoActividades: string;
  vigenciaInicio: string;
  vigenciaTermino: string;
  importeBruto: string;
  tipoPago: string;
  esRenovacion: boolean;
  folioAnterior: string;
  objetoContratacion: string;
  actividades: string[];
  responsabilidades: string[];
  perfil: {
    competenciasAdministrativas: string[];
    competenciasTecnicas: string[];
    competenciasSociales: string[];
    escolaridadMinima: string[];
    areasExperiencia: string[];
    valores: string[];
  };
}

/* ═══════════════════════════════════════════════════════════
   ASSETS (Asegúrate de tener estas imágenes en tu carpeta public)
   ═══════════════════════════════════════════════════════════ */
const LOGO_FINANZAS = path.join(process.cwd(), "public/logo-20finanzas.png");
const MARCA_MORELOS = path.join(process.cwd(), "public/LOGO_MORELOS_V1.png");

/* ═══════════════════════════════════════════════════════════
   ESTILOS CORREGIDOS (Formato Oficial)
   ═══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 70,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000",
    position: 'relative', 
  },
 watermarkContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.08, // Colores vivos
    zIndex: -1, // Detrás del texto
  },
watermarkImage: { 
    width: 600, // Ajustamos al ancho real de la hoja
    height: "auto",
    // ESTA ES LA CLAVE: Ve subiendo el 1.5 poco a poco (1.8, 2.0, 2.5...)
    // 1.5 significa 150% del tamaño original
    transform: 'scale(2.0)', 
    // Asegura que no se deforme al escalar
    objectFit: 'contain',
  },
  /* --- Encabezado (tabla 3 columnas con bordes) --- */
  headerTable: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  headerCol1: {
    width: "25%",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  logo: { width: 80, height: "auto" },
  headerCol2: {
    width: "50%",
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  headerCol3: { width: "25%", flexDirection: "column" },
  headerSecretaria: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "center",
  },
  headerSubtitle: {
    fontFamily: "Helvetica",
    fontSize: 8,
    textAlign: "center",
    marginTop: 2,
  },
  claveBox: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    padding: 4,
    justifyContent: "center",
  },
  pageBox: { flex: 1, padding: 4, justifyContent: "center" },
  claveText: { fontSize: 8, textAlign: "center" },

  /* --- Elementos de página --- */
  fechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 15 },
  centeredTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", marginBottom: 10 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 5, marginTop: 10 },

  /* --- Filas de Formulario (campos 1-11) --- */
  row: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
  bold: { fontFamily: "Helvetica-Bold" },
  numLabel: { width: 15, fontFamily: "Helvetica-Bold", fontSize: 9 },
  marginLabel: { fontFamily: "Helvetica-Bold", marginRight: 5, fontSize: 9 },
  valueText: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    fontFamily: "Helvetica",
    paddingBottom: 1,
  },

  /* --- Checkboxes --- */
  checkboxRect: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "#000",
    marginRight: 5,
    marginLeft: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  checkText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

  /* --- Vigencia (cajas Día/Mes/Año) --- */
  vigenciaBoxWrap: { flexDirection: "row", alignItems: "flex-end" },
  vigCellColumn: { alignItems: "center", marginRight: 4 },
  vigCellLabel: { fontSize: 7, marginBottom: 2 },
  vigCellBorder: {
    borderWidth: 1,
    borderColor: "#000",
    width: 25,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  /* --- Renovación (tabla con header gris) --- */
  renovContainer: {
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 8,
    marginBottom: 10,
  },
  renovHeader: {
    backgroundColor: "#D9D9D9",
    padding: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  renovHeaderText: {
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    fontSize: 8,
  },
  renovRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  renovFieldLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginLeft: 4,
    minHeight: 12,
    fontSize: 8,
    paddingBottom: 1,
  },
  checkboxSquare: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#000",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  /* --- Listas Dinámicas (Wraps) --- */
  listItemContainer: { flexDirection: "row", marginBottom: 6, paddingLeft: 10, marginTop: 5 },
  listNum: { width: 15, fontFamily: "Helvetica-Bold" },
  listTextWrap: { flex: 1, textAlign: "justify", lineHeight: 1.3 },
  bulletItemContainer: { flexDirection: "row", marginBottom: 4, paddingLeft: 20, marginTop: 3 },
  bulletSign: { width: 15, fontFamily: "Helvetica" },

  /* --- Bloque de Firmas (Elaboró / Revisó) --- */
  firmasWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingHorizontal: 10,
  },
  firmaBox: {
    width: "45%",
    alignItems: "center",
  },
  firmaLine: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    width: "100%",
    marginBottom: 4,
  },
  firmaLabel: { fontSize: 8, marginBottom: 25, textAlign: "center" },
  firmaDesc: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.3,
  },

  /* --- Estilos para Dictaminacion --- */
  dictTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textAlign: "center",
    marginBottom: 15,
    marginTop: 5,
  },
  dictP: {
    fontSize: 9,
    textAlign: "justify",
    lineHeight: 1.4,
    marginBottom: 20,
  },
  dictRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  dictBox: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 20,
  },
  dictBoxRow1: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    height: 120, // Igualado a Nombramiento
  },
  dictBoxLeft: {
    width: "35%",
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  dictBoxRight: {
    width: "65%",
    padding: 8,
    flexDirection: "column",
  },
  dictBoxRow2: {
    padding: 8,
    height: 150,
  },
  firmasDictWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingHorizontal: 10,
    width: "100%",
  },
  firmaDictBox: {
    width: "30%",
    alignItems: "center",
  },
});

/* ═══════════════════════════════════════════════════════════
   HELPER PARA ANALIZAR FECHAS (YYYY-MM-DD a DD, MM, YYYY)
   ═══════════════════════════════════════════════════════════ */
function parseDateParts(dateStr: string) {
  if (!dateStr || dateStr.trim() === "—" || dateStr.trim() === "") {
    return { d: "", m: "", y: "" };
  }
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return { y: parts[0], m: parts[1], d: parts[2] };
  }
  return { d: dateStr, m: "", y: "" };
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export function PlantillaJustificacionServicios({ data }: { data: JustificacionData }) {
  const isHonorarios = data.regimenContratacion?.toLowerCase().includes("honorarios") && !data.regimenContratacion?.toLowerCase().includes("asimilado");
  const isAsimilados = data.regimenContratacion?.toLowerCase().includes("asimilado");

  const inD = parseDateParts(data.vigenciaInicio);
  const finD = parseDateParts(data.vigenciaTermino);

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>

        {/* ══════ MARCA DE AGUA FIJA (todas las páginas) ══════ */}
        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        {/* ══════ ENCABEZADO FIJO (todas las páginas) ══════ */}
        <View style={s.headerTable} fixed>
          <View style={s.headerCol1}>
            <Image src={LOGO_FINANZAS} style={s.logo} />
          </View>
          <View style={s.headerCol2}>
            <Text style={s.headerTitle}>JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS</Text>
            <Text style={s.headerSubtitle}>(HONORARIOS Y HONORARIOS ASIMILADOS A SALARIOS)</Text>
          </View>
          <View style={s.headerCol3}>
            <View style={s.pageBox}>
              <Text style={s.claveText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`} />
            </View>
          </View>
        </View>



        {/* ══════════════════════════════════════════════
           PÁGINA 1: DATOS GENERALES + RENOVACIÓN + OBJETO
           ══════════════════════════════════════════════ */}

        <View style={s.fechaRow}>
          <Text style={s.bold}>Fecha de elaboración de la Justificación: </Text>
          <Text style={{ borderBottomWidth: 1, minWidth: 150, textAlign: "center" }}>
            {new Date().toLocaleDateString("es-MX")}
          </Text>
        </View>

        <Text style={s.centeredTitle}>JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS</Text>

        <Text style={s.sectionTitle}>I.    DATOS GENERALES:</Text>

        {/* Campo 1: Secretaría */}
        <View style={s.row}>
          <Text style={s.numLabel}>1.</Text>
          <Text style={s.marginLabel}>Secretaría/Subsecretaría/Dependencia/Organismo Auxiliar:</Text>
          <Text style={s.valueText}>{data.secretaria}</Text>
        </View>

        {/* Campo 2: Unidad Administrativa */}
        <View style={s.row}>
          <Text style={s.numLabel}>2.</Text>
          <Text style={s.marginLabel}>Unidad Administrativa de Adscripción:</Text>
          <Text style={{ fontSize: 7, marginRight: 5 }}>(área donde se prestará el servicio)</Text>
          <Text style={s.valueText}>{data.unidadAdministrativa}</Text>
        </View>

        {/* Campo 3: Unidad Responsable */}
        <View style={s.row}>
          <Text style={s.numLabel}>3.</Text>
          <Text style={s.marginLabel}>Unidad Responsable del Gasto:</Text>
          <Text style={s.valueText}>{data.unidadResponsable}</Text>
        </View>

        {/* Campo 4: Programa */}
        <View style={s.row}>
          <Text style={s.numLabel}>4.</Text>
          <Text style={s.marginLabel}>Programa o Proyecto:</Text>
          <Text style={s.valueText}>{data.programaProyecto}</Text>
        </View>

        {/* Campo 5: Régimen con checkboxes */}
        <View style={{ ...s.row, alignItems: "center" }}>
          <Text style={s.numLabel}>5.</Text>
          <Text style={s.marginLabel}>Régimen de Contratación:</Text>
          <View style={s.checkboxRect}>{isHonorarios && <Text style={s.checkText}>X</Text>}</View>
          <Text style={{ marginRight: 20 }}>Honorarios</Text>
          <View style={s.checkboxRect}>{isAsimilados && <Text style={s.checkText}>X</Text>}</View>
          <Text>Honorarios Asimilados a Salarios</Text>
        </View>

        {/* Campo 6: Tipo de Actividades */}
        <View style={s.row}>
          <Text style={s.numLabel}>6.</Text>
          <Text style={s.marginLabel}>Tipo de Actividades:</Text>
          <Text style={s.valueText}>{data.tipoActividades}</Text>
        </View>

        {/* Campo 7: Número de Prestadores */}
        <View style={s.row}>
          <Text style={s.numLabel}>7.</Text>
          <Text style={s.marginLabel}>Número de Prestadores de Servicios:</Text>
          <Text style={s.valueText}>{data.numeroPrestadores}</Text>
        </View>

        {/* Campo 8: Vigencia con Cajas */}
        <View style={{ ...s.row, alignItems: "flex-end", marginTop: 5 }}>
          <Text style={s.numLabel}>8.</Text>
          <Text style={s.marginLabel}>Vigencia (inicio-término):</Text>
          <View style={s.vigenciaBoxWrap}>
            <View style={s.vigCellColumn}><Text style={s.vigCellLabel}>Día</Text><View style={s.vigCellBorder}><Text>{inD.d}</Text></View></View>
            <View style={s.vigCellColumn}><Text style={s.vigCellLabel}>Mes</Text><View style={s.vigCellBorder}><Text>{inD.m}</Text></View></View>
            <View style={s.vigCellColumn}><Text style={s.vigCellLabel}>Año</Text><View style={s.vigCellBorder}><Text>{inD.y}</Text></View></View>
            <Text style={{ marginHorizontal: 8, paddingBottom: 2 }}>al</Text>
            <View style={s.vigCellColumn}><Text style={s.vigCellLabel}>Día</Text><View style={s.vigCellBorder}><Text>{finD.d}</Text></View></View>
            <View style={s.vigCellColumn}><Text style={s.vigCellLabel}>Mes</Text><View style={s.vigCellBorder}><Text>{finD.m}</Text></View></View>
            <View style={s.vigCellColumn}><Text style={s.vigCellLabel}>Año</Text><View style={s.vigCellBorder}><Text>{finD.y}</Text></View></View>
          </View>
        </View>

        {/* Campo 9: Importe Bruto */}
        <View style={{ ...s.row, marginTop: 5 }}>
          <Text style={s.numLabel}>9.</Text>
          <Text style={s.marginLabel}>Importe Bruto:</Text>
          <Text style={s.valueText}>{data.importeBruto}</Text>
        </View>

        {/* Campo 10: Tipo de Pago */}
        <View style={{ ...s.row, marginTop: 5 }}>
          <Text style={s.numLabel}>10.</Text>
          <Text style={s.marginLabel}>Tipo de Pago:</Text>
          <Text style={s.valueText}>{data.tipoPago}</Text>
        </View>

        {/* ══════════════════════════════════════════════
           I.1 OBJETO DE LA CONTRATACIÓN
           ══════════════════════════════════════════════ */}
        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 15 }}>I.1.    OBJETO DE LA CONTRATACIÓN:</Text>
          <Text style={{ textAlign: "justify", lineHeight: 1.3, marginBottom: 10, marginTop: 5 }}>{data.objetoContratacion}</Text>
        </View>

        {/* ══════════════════════════════════════════════
           PÁGINA 2: ACTIVIDADES + RESPONSABILIDADES + PERFIL
           ══════════════════════════════════════════════ */}

        {/* I.2 ACTIVIDADES — mapeado dinámico con .map() */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>I.2.    ACTIVIDADES A REALIZAR POR EL PRESTADOR DE SERVICIOS:</Text>
          {data.actividades?.slice(0, 1).map((act, index) => (
            <View key={`act-${index}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 1}.</Text>
              <Text style={s.listTextWrap}>{act}</Text>
            </View>
          ))}
        </View>
        {data.actividades?.slice(1).map((act, index) => (
          <View key={`act-${index + 1}`} style={s.listItemContainer} wrap={false}>
            <Text style={s.listNum}>{index + 2}.</Text>
            <Text style={s.listTextWrap}>{act}</Text>
          </View>
        ))}

        {/* I.3 RESPONSABILIDADES — mapeado dinámico con .map() */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>I.3.    RESPONSABILIDADES A CUMPLIR POR EL PRESTADOR DE SERVICIOS:</Text>
          {data.responsabilidades?.slice(0, 1).map((resp, index) => (
            <View key={`resp-${index}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 1}.</Text>
              <Text style={s.listTextWrap}>{resp}</Text>
            </View>
          ))}
        </View>
        {data.responsabilidades?.slice(1).map((resp, index) => (
          <View key={`resp-${index + 1}`} style={s.listItemContainer} wrap={false}>
            <Text style={s.listNum}>{index + 2}.</Text>
            <Text style={s.listTextWrap}>{resp}</Text>
          </View>
        ))}

        {/* ── II. PERFIL ── */}
        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 15 }}>II.  PERFIL A CUBRIR POR EL PRESTADOR DE SERVICIOS:</Text>
          <Text style={{ marginBottom: 5, fontSize: 8 }}>(Se refiere a la escolaridad, competencias y experiencia)</Text>
        </View>

        {/* II.1 Escolaridad — mapeado dinámico */}
        <Text style={s.bold}>II. 1.  ESCOLARIDAD MÍNIMA:</Text>
        {data.perfil?.escolaridadMinima?.map((esc, i) => (
          <View key={`esc-${i}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap}>{esc}</Text>
          </View>
        ))}

        {/* II.2 Competencias */}
        <Text style={{ ...s.bold, marginTop: 5 }}>II. 2.  COMPETENCIAS LABORALES REQUERIDAS:</Text>

        {/* II.2.1 Administrativas — mapeado dinámico */}
        <Text style={{ ...s.bold, marginLeft: 15, marginTop: 3 }}>II. 2.1.  Administrativas:</Text>
        {data.perfil?.competenciasAdministrativas?.map((comp, i) => (
          <View key={`ca-${i}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        {/* II.2.2 Técnicas — mapeado dinámico */}
        <Text style={{ ...s.bold, marginLeft: 15, marginTop: 3 }}>II. 2.2.  Técnicas:</Text>
        {data.perfil?.competenciasTecnicas?.map((comp, i) => (
          <View key={`ct-${i}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        {/* II.2.3 Sociales — mapeado dinámico */}
        <Text style={{ ...s.bold, marginLeft: 15, marginTop: 3 }}>II. 2.3.  Sociales:</Text>
        {data.perfil?.competenciasSociales?.map((comp, i) => (
          <View key={`cs-${i}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        {/* ══════════════════════════════════════════════
           PÁGINA 3: VALORES + EXP + FIRMAS
           ══════════════════════════════════════════════ */}

        {/* II.2.4 Valores — mapeado dinámico */}
        <Text style={{ ...s.bold, marginLeft: 15, marginTop: 3 }}>II. 2.4.  Valores:</Text>
        {data.perfil?.valores?.map((val, i) => (
          <View key={`val-${i}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap}>{val}</Text>
          </View>
        ))}

        {/* II.3 Áreas de Experiencia — mapeado dinámico */}
        <Text style={{ ...s.bold, marginTop: 5 }}>II.3.  ÁREAS DE EXPERIENCIA:</Text>
        {data.perfil?.areasExperiencia?.map((area, i) => (
          <View key={`ae-${i}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap}>{area}</Text>
          </View>
        ))}

        <View style={{ flex: 1 }} />

        {/* ══════ FIRMAS (Elaboró / Revisó) ══════ */}
        <View style={s.firmasWrapper} wrap={false}>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Elaboró</Text>
            <View style={s.firmaLine}></View>
            <Text style={s.firmaDesc}>Nombre y cargo de la</Text>
            <Text style={s.firmaDesc}>Persona Titular de la Unidad Administrativa u Organismo Auxiliar</Text>
          </View>
          <View style={s.firmaBox}>
            <Text style={s.firmaLabel}>Revisó</Text>
            <View style={s.firmaLine}></View>
            <Text style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la</Text>
            <Text style={s.firmaDesc}>Unidad de Enlace Financiero Administrativo o Equivalente</Text>
          </View>
        </View>

      </Page>

      {/* ══════════════════════════════════════════════
         NUEVA PÁGINA: Dictaminación / Opinión Técnica
         ══════════════════════════════════════════════ */}
      <Page size="LETTER" style={s.page} wrap>
        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        <View style={s.headerTable} fixed>
          <View style={s.headerCol1}>
            <Image src={LOGO_FINANZAS} style={s.logo} />
          </View>
          <View style={s.headerCol2}>
            <Text style={s.headerTitle}>JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS</Text>
            <Text style={s.headerSubtitle}>(HONORARIOS Y HONORARIOS ASIMILADOS A SALARIOS)</Text>
          </View>
          <View style={s.headerCol3}>
            <View style={s.pageBox}>
              <Text style={s.claveText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`} />
            </View>
          </View>
        </View>

        {data.tipoAdministracion === "centralizada" ? (
          <>
            <Text style={s.dictTitle}>DICTAMINACIÓN TÉCNICA FUNCIONAL DE PRESTACIÓN DE SERVICIOS{"\n"}(ÁREA EXCLUSIVA PARA LA DIRECCIÓN GENERAL DE DESARROLLO ORGANIZACIONAL)</Text>
            <Text style={s.dictP}>
              Con fundamento en lo dispuesto por los artículos 1, 9, fracción III y 24, fracción XL, de la Ley Orgánica de la Administración Pública para el Estado Libre y Soberano de Morelos, en relación con los numerales 1, 5, fracción XIV, 7, 10, fracción XVII y 23, fracción III, del Reglamento Interior de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal y demás disposiciones jurídicas y administrativas aplicables y una vez realizado el análisis técnico funcional se determina que la Justificación de Prestación de Servicios Profesionales, relativa a la(s) contratación(es) que se menciona(n), cumple con la metodología y los requisitos establecidos por la Dirección General de Desarrollo Organizacional de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal, por lo que se emite el Dictamen Técnico Funcional de Justificación de Prestación de Servicios Profesionales:
            </Text>
          </>
        ) : (
          <>
            <Text style={s.dictTitle}>OPINIÓN FUNCIONAL DE JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS PROFESIONALES</Text>
            <Text style={s.dictP}>
              Con fundamento en lo dispuesto por los artículos 1, 9, fracción III, 24, fracción XL y 46, de la Ley Orgánica de la Administración Pública para el Estado Libre y Soberano de Morelos, en relación con los numerales 1, 5, fracción XIV, 7, 10, fracción XVII y 23, fracciones IV y VI, del Reglamento Interior de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal y demás disposiciones jurídicas y administrativas aplicables y una vez realizado el análisis técnico funcional se determina que la Justificación de Prestación de Servicios Profesionales, relativa a la(s) contratación(es) que se menciona(n), cumple con la metodología y los requisitos establecidos por la Dirección General de Desarrollo Organizacional de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal, por lo que se emite la Opinión Funcional de Justificación de Prestación de Servicios Profesionales:
            </Text>
          </>
        )}

        <View style={s.dictRow}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Dictamen Técnico Funcional: </Text>
          <View style={s.checkboxRect}>
            {data.tipoAdministracion === "centralizada" && <Text style={s.checkText}>X</Text>}
          </View>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginLeft: 30 }}>Opinión Técnica Funcional: </Text>
          <View style={s.checkboxRect}>
            {data.tipoAdministracion === "paraestatal" && <Text style={s.checkText}>X</Text>}
          </View>
        </View>

        <View style={s.dictBox} wrap={false}>
          <View style={s.dictBoxRow1}>
            <View style={s.dictBoxLeft}>
              <Text style={{ fontSize: 9 }}>Fecha de dictaminación:</Text>
            </View>
            <View style={{ ...s.dictBoxRight, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 9, marginBottom: 5 }}>Estatus:</Text>
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 9, marginBottom: 5 }}>(Sello Dictamen)</Text>
              </View>
              <Text style={{ fontSize: 7, textAlign: "justify", width: "100%" }}>El presente Dictamen/Opinión se podrá seguir utilizando para las siguientes contrataciones bajo las mismas condiciones técnicas y funcionales.</Text>
            </View>
          </View>
          <View style={s.dictBoxRow2}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>Nota:</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={s.firmasDictWrapper} wrap={false}>
          <View style={s.firmaDictBox}>
            <Text style={s.firmaLabel}>Revisó</Text>
            <View style={s.firmaLine}></View>
            <Text style={s.firmaDesc}>Nombre y cargo de la Persona responsable de la revisión de la Justificación</Text>
          </View>
          <View style={s.firmaDictBox}>
            <Text style={s.firmaLabel}>Verificó</Text>
            <View style={s.firmaLine}></View>
            <Text style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la Dirección de Análisis Normativo y Funcional</Text>
          </View>
          <View style={s.firmaDictBox}>
            <Text style={s.firmaLabel}>Emitió</Text>
            <View style={s.firmaLine}></View>
            <Text style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la Dirección General de Desarrollo Organizacional</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}