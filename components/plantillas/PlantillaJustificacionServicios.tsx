import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";
import fs from "fs";
import React from "react";
import { toRoman } from "@/lib/roman-list";
import { siglasSecretaria } from "@/lib/clave-dictamen";
import { resolveQuetzalliSansPath } from "@/lib/pdf-fonts";
import { FauxBoldText } from "@/components/plantillas/faux-bold-text";

Font.register({
  family: "NotoSymbols",
  src: path.join(process.cwd(), "public/fonts/NotoSansSymbols2-Regular.ttf"),
});

const quetzalliPath = resolveQuetzalliSansPath();
if (quetzalliPath) {
  Font.register({
    family: "QuetzalliSans",
    fonts: [
      { src: quetzalliPath },
      { src: quetzalliPath, fontStyle: "italic" },
    ],
  });
}
// Solo existe el peso Thin de QuetzalliSans por ahora — se usa la misma
// familia para "bold" (react-pdf no puede negritar sintéticamente); en
// cuanto se agregue el peso Bold real, registrarlo aparte y usarlo aquí.
const FONT_REGULAR = quetzalliPath ? "QuetzalliSans" : "Helvetica";
const FONT_BOLD = quetzalliPath ? "QuetzalliSans" : "Helvetica-Bold";

const PALABRAS_MENORES = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u",
  "en", "a", "al", "con", "por", "para",
]);

function toTitleCaseES(input: string): string {
  if (!input) return input;
  let wordIndex = 0;
  return input.toLocaleLowerCase("es").replace(/[\p{L}\p{N}]+/gu, (word) => {
    const capitalized =
      wordIndex > 0 && PALABRAS_MENORES.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("es") + word.slice(1);
    wordIndex++;
    return capitalized;
  });
}

function folioSinSiglas(folio: string | null | undefined): string {
  if (!folio) return "";
  return folio.replace(/^[^\d/]+\/+/, "");
}

export interface JustificacionData {
  tipoAdministracion: 'centralizada' | 'paraestatal';
  formato: 'fisico' | 'en_linea';
  secretaria: string;
  unidadAdministrativa: string;
  unidadResponsable: string;
  oficioSolicitud?: string;
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
  firmaElaboroNombre?: string;
  firmaRevisoNombre?: string;
  firmaDictRevisoNombre?: string;
  firmaDictVerificoNombre?: string;
  firmaDictEmitioNombre?: string;
  firmaElaboroCargo?: string;
  firmaRevisoCargo?: string;
  firmaDictRevisoCargo?: string;
  firmaDictVerificoCargo?: string;
  firmaDictEmitioCargo?: string;
  fechaDictaminacion?: string;
  ocultarFirmas?: boolean;
  clave?: string;
  // Folio de dictamen "limpio" (sin siglas), para la caja "Folio:" de la página
  // del Dictamen/Opinión. Puede llevar el consecutivo de reutilización pegado
  // (ej. "08/08/2026-2") cuando esta justificación nació de una reutilización
  // del catálogo; a diferencia de `clave`/"Justificación:", que nunca lo lleva.
  // Si no se manda, se deriva de `clave` quitándole las siglas (compatibilidad).
  folio?: string;
  notaDictamen?: string;
  // La página del Dictamen/Opinión Técnica Funcional solo tiene sentido una vez
  // que ese dictamen realmente existe (solicitud.dictamen emitido). Antes de eso
  // (Mis Solicitudes, Validación UEFA, Revisión, Validación) la descarga de
  // "Justificación" debe traer solo la página 1. Por defecto true para no romper
  // llamadores existentes (firma, catálogo histórico) que sí siempre la esperan.
  incluirPaginaDictamen?: boolean;
}

const NOTA_DICTAMEN_DEFAULT =
  "Esta Dirección General únicamente dictamina sobre la funcionalidad de las actividades conforme con la metodología establecida y queda fuera de sus atribuciones la distribución y ejecución de los recursos para el pago de las contrataciones, en las cuales se deberá observar lo dispuesto por el Artículo Quinto del Presupuesto de Egresos del Gobierno del Estado de Morelos para el ejercicio fiscal 2026 y demás normatividad aplicable.";

const LOGO_FINANZAS = fs.readFileSync(path.join(process.cwd(), "public/logo-20finanzas.png"));
const MARCA_MORELOS = fs.readFileSync(path.join(process.cwd(), "public/LOGO_MORELOS_V1.png"));

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 70,
    paddingHorizontal: 40,
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    lineHeight: 1.15,
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
    opacity: 0.12,
    zIndex: -1,
  },
  pageFrame: {
    position: "absolute",
    top: 18,
    left: 22,
    right: 22,
    bottom: 18,
    borderWidth: 1,
    borderColor: "#000",
  },
  watermarkImage: {
    width: 600,
    height: "auto",
    transform: 'scale(2.5)',
    objectFit: 'contain',
  },
  headerTable: {
    flexDirection: "row",
    marginTop: -12,
    marginLeft: -18,
    marginRight: -18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#000",
  },
  headerCol1: {
    width: "25%",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  logo: { width: 110, height: "auto" },
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
    fontFamily: FONT_BOLD,
    fontSize: 11,
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 0.6,
  },
  headerTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  headerSubtitle: {
    fontFamily: FONT_REGULAR,
    fontSize: 8,
    textAlign: "center",
    marginTop: 3,
  },
  claveBox: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    padding: 4,
    justifyContent: "center",
  },
  pageBox: { flex: 1, paddingHorizontal: 4, justifyContent: "center" },
  claveText: { fontSize: 8, textAlign: "center" },

  fechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10, marginRight: -63 },
  centeredTitle: { fontFamily: FONT_BOLD, fontSize: 10, textAlign: "center", marginBottom: 12 , letterSpacing: 0.6},
  sectionTitle: { fontFamily: FONT_BOLD, fontSize: 10, marginBottom: 4, marginTop: 10 , letterSpacing: 0.6},

  // flex-start (no flex-end): si el valor es largo y hace wrap a 2 renglones
  // (p. ej. Programa o Proyecto), la etiqueta debe alinearse con el PRIMER
  // renglón del valor, no con el último — si no, la etiqueta queda más abajo
  // que donde empieza el texto, como "rota" respecto al primer renglón.
  row: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start", marginLeft: 32 },
  bold: { fontFamily: FONT_BOLD , letterSpacing: 0.6},
  numLabel: { width: 15, fontFamily: FONT_REGULAR, fontSize: 9 },
  marginLabel: { fontFamily: FONT_REGULAR, marginRight: 5, fontSize: 9 },
  valueText: {
    flex: 1,
    fontSize: 9,
    fontFamily: FONT_REGULAR,
  },

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
  // Se fuerza Helvetica-Bold (no FONT_BOLD/QuetzalliSans): dentro de una caja
  // de 12x12 con borde, la métrica de línea de QuetzalliSans es demasiado alta
  // y Yoga descarta el glifo por completo — la "X" queda invisible aunque el
  // régimen sí esté seleccionado.
  checkText: { fontSize: 8, fontFamily: "Helvetica-Bold" , letterSpacing: 0.6},

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
    fontFamily: FONT_BOLD,
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

  listTextWrap: { flex: 1, fontSize: 9, textAlign: "justify", lineHeight: 1.4 },
  romanItem: { marginLeft: 32, marginBottom: 6 },
  romanText: { fontSize: 9, textAlign: "justify", lineHeight: 1.4 },
  bulletItemContainer: { flexDirection: "row", marginBottom: 3, paddingLeft: 72 },
  bulletSign: { width: 15, fontSize: 7, fontFamily: "NotoSymbols" },

  firmasWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  firmaLabel: { fontSize: 8, marginBottom: 5, textAlign: "center" },
  firmaNombre: { fontSize: 9, fontFamily: FONT_BOLD, textAlign: "center", marginBottom: 5, minHeight: 12 , letterSpacing: 0.6},
  firmaDesc: {
    fontFamily: FONT_BOLD,
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0.6,
  },

  pdcPage: {
    paddingTop: 30,
    paddingBottom: 90,
    paddingHorizontal: 40,
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    color: "#000",
    position: "relative",
  },
  pdcPageFrame: {
    position: "absolute",
    top: 18,
    left: 22,
    right: 22,
    bottom: 75,
    borderWidth: 1,
    borderColor: "#000",
  },
  pdcHeaderTable: {
    flexDirection: "row",
    marginTop: -12,
    marginLeft: -18,
    marginRight: -18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#000",
  },
  pdcHeaderCol1: {
    width: "22%",
    padding: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  pdcLogo: { width: 100, height: "auto" },
  pdcHeaderCol2: {
    width: "53%",
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  pdcHeaderTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0.6,
  },
  pdcHeaderCol3: { width: "25%", flexDirection: "column" },
  pdcFolioBox: {
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 34,
  },
  pdcFolioText: { fontSize: 8, textAlign: "left" },
  pdcPageBox: { padding: 4, justifyContent: "center", minHeight: 16 },
  pdcPageText: { fontSize: 8, textAlign: "left" },

  pdcFechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 },
  pdcFechaText: { fontSize: 9 },

  pdcFieldRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
  pdcFieldLabel: { width: "30%", fontSize: 9, fontFamily: FONT_REGULAR },
  pdcFieldLabelBox: {
    width: "30%",
    fontSize: 9,
    fontFamily: FONT_REGULAR,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  pdcFieldValue: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    paddingBottom: 1,
    paddingHorizontal: 2,
    minHeight: 12,
  },
  pdcFieldValueMulti: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    paddingBottom: 2,
    paddingHorizontal: 2,
    lineHeight: 1.4,
  },

  pdcRegimenRow: { flexDirection: "row", marginBottom: 10, alignItems: "center" },
  pdcRegimenLabel: {
    width: "30%",
    fontSize: 9,
    fontFamily: FONT_REGULAR,
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginRight: 6,
  },
  pdcRegimenBoxes: { flexDirection: "row", alignItems: "center", flex: 1 },
  pdcCheckLabel: { fontSize: 9, marginRight: 20 },

  pdcFundamentoText: { fontSize: 9, textAlign: "justify", lineHeight: 1.4, marginTop: 10, marginBottom: 12 },

  pdcImporteSubText: { fontSize: 8, fontStyle: "italic", marginTop: 2, marginBottom: 6, marginLeft: "30%", color: "#333" },

  pdcVigenciaRow: { flexDirection: "row", marginBottom: 10, alignItems: "flex-end" },
  pdcVigCellColumn: { alignItems: "center", marginRight: 4 },
  pdcVigCellLabel: { fontSize: 7, marginBottom: 2 },
  pdcVigCellBorder: {
    borderWidth: 1,
    borderColor: "#000",
    width: 26,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  pdcVigCellValue: { fontSize: 8 },

  pdcNotaWrapper: { marginTop: 12, marginBottom: 6 },
  pdcNotaTitle: { fontFamily: FONT_BOLD, fontSize: 9, marginBottom: 2 , letterSpacing: 0.6},
  pdcNotaText: { fontSize: 8, textAlign: "justify", lineHeight: 1.4 },

  pdcFooterTable: {
    position: "absolute",
    bottom: 22,
    left: 22,
    right: 22,
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  pdcFooterLeft: { width: "60%", padding: 6 },
  pdcFooterRight: { width: "40%", padding: 6 },
  pdcFooterLine: { fontSize: 8, marginBottom: 2 },
  pdcFooterLabelBold: { fontFamily: FONT_BOLD },

  firmasDictWrapper: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
  },
  firmaDictBox: {
    flex: 1,
    minHeight: 125,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  firmaDictBoxLast: {
    flex: 1,
    minHeight: 125,
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 6,
  },
});

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

export function PlantillaJustificacionServicios({ data }: { data: JustificacionData }) {
  const isHonorarios = data.regimenContratacion?.toLowerCase().includes("honorarios") && !data.regimenContratacion?.toLowerCase().includes("asimilado");
  const isAsimilados = data.regimenContratacion?.toLowerCase().includes("asimilado");

  const inD = parseDateParts(data.vigenciaInicio);
  const finD = parseDateParts(data.vigenciaTermino);
  const folioPlano = data.folio ?? folioSinSiglas(data.clave);
  const tituloFormatoDictamen =
    data.tipoAdministracion === "centralizada"
      ? "Dictamen Técnico Funcional de Justificación de Prestación de Servicios"
      : "Opinión Técnica Funcional de Justificación de Prestación de Servicios";

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>

        <View style={s.pageFrame} fixed />
        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        <View style={s.headerTable} fixed>
          <View style={s.headerCol1}>
            <Image src={LOGO_FINANZAS} style={s.logo} />
          </View>
          <View style={s.headerCol2}>
            <FauxBoldText style={s.headerTitle}>JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS</FauxBoldText>
            <FauxBoldText style={{ ...s.headerSubtitle, fontFamily: FONT_BOLD }}>SECRETARÍAS, DEPENDENCIAS Y ORGANISMOS AUXILIARES</FauxBoldText>
          </View>
          <View style={s.headerCol3}>
            <View style={s.claveBox}>
              <Text style={s.claveText}>{data.clave || siglasSecretaria(data.secretaria) || "Clave"}</Text>
            </View>
            <View style={s.pageBox}>
              <Text style={s.claveText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`} />
            </View>
          </View>
        </View>

        <View style={s.fechaRow}>
          <FauxBoldText style={s.bold}>Fecha : </FauxBoldText>
          <FauxBoldText style={{ minWidth: 150, textAlign: "center" }}>
            {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
          </FauxBoldText>
        </View>

        <Text style={{ fontSize: 8, textAlign: "justify", lineHeight: 1.4, marginBottom: 10 }}>
          Nota: La presente Justificación de Prestación de Servicios es una referencia para la contratación de personas y deberá atender a criterios no discriminatorios.
        </Text>

        <FauxBoldText style={s.centeredTitle}>1.  JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS</FauxBoldText>

        <FauxBoldText style={s.sectionTitle}>1.1    DATOS GENERALES DE LA PRESTACIÓN DE SERVICIOS:</FauxBoldText>

        <View style={s.row}>
          <Text style={s.marginLabel}>Régimen de Contratación:</Text>
          <Text style={s.valueText}>{isHonorarios ? "Honorarios" : isAsimilados ? "Honorarios Asimilados a Salarios" : ""}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.marginLabel}>Tipo de servicios:</Text>
          <Text style={s.valueText}>{data.tipoActividades || ""}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.marginLabel}>Secretaría/Subsecretaría/Dependencia/Organismo Auxiliar:</Text>
          <Text style={s.valueText}>{toTitleCaseES(data.secretaria)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.marginLabel}>Unidad Responsable de Gasto:</Text>
          <Text style={s.valueText}>{toTitleCaseES(data.unidadResponsable)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.marginLabel}>Importe bruto:</Text>
          <Text style={s.valueText}>{data.importeBruto}</Text>
        </View>

        {/* Texto en línea (un solo <Text> con hijos anidados), no fila flex:
            "Programa o Proyecto" suele ser largo y necesitar 2 renglones —
            con flexDirection:"row" el renglón que rebasa puede dibujarse
            arriba de la fila en vez de abajo (bug de wrap de react-pdf). Con
            <Text> anidado, el wrap es el mismo que el de un párrafo normal. */}
        <Text style={{ fontSize: 9, marginLeft: 32, marginBottom: 8 }}>
          <Text style={{ ...s.marginLabel, marginRight: 0 }}>Programa o Proyecto:  </Text>
          <Text style={s.valueText}>{data.programaProyecto}</Text>
        </Text>

        {/* Ocultos a pedido del usuario (no eliminar, solo comentado):
        <View style={s.row}>
          <Text style={s.numLabel}>7.</Text>
          <Text style={s.marginLabel}>Unidad Administrativa de Adscripción:</Text>
          <Text style={{ fontSize: 7, marginRight: 5 }}>(área donde se prestará el servicio)</Text>
          <Text style={s.valueText}>{toTitleCaseES(data.unidadAdministrativa)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>8.</Text>
          <Text style={s.marginLabel}>Número de Prestadores de Servicios:</Text>
          <Text style={s.valueText}>{data.numeroPrestadores}</Text>
        </View>

        <View style={{ ...s.row, alignItems: "flex-end", marginTop: 5 }}>
          <Text style={s.numLabel}>9.</Text>
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

        <View style={{ ...s.row, marginTop: 5 }}>
          <Text style={s.numLabel}>10.</Text>
          <Text style={s.marginLabel}>Tipo de Pago:</Text>
          <Text style={s.valueText}>{data.tipoPago}</Text>
        </View>
        */}

        <View wrap={false}>
          <FauxBoldText style={s.sectionTitle}>1.2    OBJETO DE LA CONTRATACIÓN:</FauxBoldText>
          <Text style={{ fontSize: 9, textAlign: "justify", lineHeight: 1.15, marginBottom: 8, marginLeft: 32 }}>{data.objetoContratacion}</Text>
        </View>

        <View wrap={false}>
          <FauxBoldText style={s.sectionTitle}>1.3    ACTIVIDADES DEL PRESTADOR DE SERVICIOS:</FauxBoldText>
          {data.actividades?.slice(0, 1).map((act, index) => (
            <View key={`act-${index}`} style={s.romanItem}>
              <Text style={s.romanText}>{toRoman(index + 1)}. {act}</Text>
            </View>
          ))}
        </View>
        {data.actividades?.slice(1).map((act, index) => (
          <View key={`act-${index + 1}`} style={s.romanItem} wrap={false}>
            <Text style={s.romanText}>{toRoman(index + 2)}. {act}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={s.sectionTitle}>1.4    RESPONSABILIDADES DEL PRESTADOR DE SERVICIOS:</FauxBoldText>
          {data.responsabilidades?.slice(0, 1).map((resp, index) => (
            <View key={`resp-${index}`} style={s.romanItem}>
              <Text style={s.romanText}>{toRoman(index + 1)}. {resp}</Text>
            </View>
          ))}
        </View>
        {data.responsabilidades?.slice(1).map((resp, index) => (
          <View key={`resp-${index + 1}`} style={s.romanItem} wrap={false}>
            <Text style={s.romanText}>{toRoman(index + 2)}. {resp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={s.sectionTitle}>2  PERFIL A CUBRIR POR EL PRESTADOR DE SERVICIOS:</FauxBoldText>
          <Text style={{ marginBottom: 4, fontSize: 8 }}>(Se refiere a la escolaridad, competencias y experiencia, necesarios para la contratación)</Text>

          <FauxBoldText style={{ ...s.bold, marginBottom: 4 }}>2.1  ESCOLARIDAD MÍNIMA:</FauxBoldText>
          {data.perfil?.escolaridadMinima?.slice(0, 1).map((esc, i) => (
            <View key={`esc-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap}>{esc}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.escolaridadMinima?.slice(1).map((esc, i) => (
          <View key={`esc-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap}>{esc}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={{ ...s.bold, marginTop: 6, marginBottom: 4 }}>2.2  COMPETENCIAS DEL PRESTADOR DE SERVICIOS:</FauxBoldText>
          <FauxBoldText style={{ ...s.bold, marginLeft: 48, marginTop: 6, marginBottom: 4 }}>2.2.1  Competencias Administrativas:</FauxBoldText>
          {data.perfil?.competenciasAdministrativas?.slice(0, 1).map((comp, i) => (
            <View key={`ca-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasAdministrativas?.slice(1).map((comp, i) => (
          <View key={`ca-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={{ ...s.bold, marginLeft: 48, marginTop: 6, marginBottom: 4 }}>2.2.2  Competencias Técnicas:</FauxBoldText>
          {data.perfil?.competenciasTecnicas?.slice(0, 1).map((comp, i) => (
            <View key={`ct-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasTecnicas?.slice(1).map((comp, i) => (
          <View key={`ct-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={{ ...s.bold, marginLeft: 48, marginTop: 6, marginBottom: 4 }}>2.2.3  Competencias Sociales:</FauxBoldText>
          {data.perfil?.competenciasSociales?.slice(0, 1).map((comp, i) => (
            <View key={`cs-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasSociales?.slice(1).map((comp, i) => (
          <View key={`cs-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={{ ...s.bold, marginLeft: 48, marginTop: 6, marginBottom: 4 }}>2.2.4  valores:</FauxBoldText>
          {data.perfil?.valores?.slice(0, 1).map((val, i) => (
            <View key={`val-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap}>{val}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.valores?.slice(1).map((val, i) => (
          <View key={`val-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap}>{val}</Text>
          </View>
        ))}

        <View wrap={false}>
          <FauxBoldText style={{ ...s.bold, marginTop: 6, marginBottom: 4 }}>2.3  ÁREAS DE EXPERIENCIA DEL PRESTADOR DE SERVICIOS:</FauxBoldText>
          {data.perfil?.areasExperiencia?.slice(0, 1).map((area, i) => (
            <View key={`ae-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap}>{area}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.areasExperiencia?.slice(1).map((area, i) => (
          <View key={`ae-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap}>{area}</Text>
          </View>
        ))}

        {!data.ocultarFirmas ? (
          <View wrap={false} style={{ marginTop: 25 }}>
            {data.formato === 'en_linea' ? (
              <View style={{ marginBottom: 15, alignItems: 'center' }}>
                <FauxBoldText style={{ fontFamily: FONT_BOLD, fontSize: 10, textAlign: 'center', marginBottom: 4, letterSpacing: 0.6 }}>ATENTAMENTE</FauxBoldText>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, textAlign: 'center', marginBottom: 2, color: '#B00020', letterSpacing: 0.6 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
                <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
                  a través de un certificado reconocido legalmente y tiene, en relación a la información firmada, un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
                </Text>
              </View>
            ) : null}

            <View style={s.firmasWrapper} wrap={false}>
              <View style={s.firmaBox}>
                <Text style={s.firmaLabel}>Elaboró</Text>
                <FauxBoldText style={s.firmaNombre}>{data.firmaElaboroNombre || ""}</FauxBoldText>
                <View style={s.firmaLine}></View>
                {data.firmaElaboroNombre && data.firmaElaboroCargo ? (
                  <FauxBoldText style={s.firmaDesc}>{data.firmaElaboroCargo}</FauxBoldText>
                ) : (
                  <View>
                    <FauxBoldText style={s.firmaDesc}>Nombre y cargo de la</FauxBoldText>
                    <FauxBoldText style={s.firmaDesc}>Persona Titular de la Unidad Administrativa u Organismo Auxiliar</FauxBoldText>
                  </View>
                )}
              </View>
              <View style={s.firmaBox}>
                <Text style={s.firmaLabel}>Revisó</Text>
                <FauxBoldText style={s.firmaNombre}>{data.firmaRevisoNombre || ""}</FauxBoldText>
                <View style={s.firmaLine}></View>
                {data.firmaRevisoNombre && data.firmaRevisoCargo ? (
                  <FauxBoldText style={s.firmaDesc}>{data.firmaRevisoCargo}</FauxBoldText>
                ) : (
                  <View>
                    <FauxBoldText style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la</FauxBoldText>
                    <FauxBoldText style={s.firmaDesc}>Unidad de Enlace Financiero Administrativo o Equivalente</FauxBoldText>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : null}

      </Page>

      {(data.incluirPaginaDictamen ?? true) && (
      <Page size="LETTER" style={s.pdcPage} wrap>
        <View style={s.pdcPageFrame} fixed />

        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        <View style={s.pdcHeaderTable} fixed>
          <View style={s.pdcHeaderCol1}>
            <Image src={LOGO_FINANZAS} style={s.pdcLogo} />
          </View>
          <View style={s.pdcHeaderCol2}>
            <FauxBoldText style={s.pdcHeaderTitle}>{tituloFormatoDictamen.toUpperCase()}</FauxBoldText>
          </View>
          <View style={s.pdcHeaderCol3}>
            <View style={s.pdcFolioBox}>
              <Text style={s.pdcFolioText}>Folio: {folioPlano || ""}</Text>
            </View>
            <View style={s.pdcPageBox}>
              <Text
                style={s.pdcPageText}
                render={({ pageNumber, totalPages }) => `Pág.: ${pageNumber} de ${totalPages}`}
              />
            </View>
          </View>
        </View>

        <View style={s.pdcFechaRow}>
          <FauxBoldText style={s.pdcFechaText}>Fecha : </FauxBoldText>
          <FauxBoldText style={s.pdcFechaText}>{data.fechaDictaminacion || ""}</FauxBoldText>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabelBox}>Secretaría/Dependencia:</Text>
          <Text style={s.pdcFieldValue}>{toTitleCaseES(data.secretaria)}</Text>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabelBox}>Unidad Responsable del Gasto:</Text>
          <Text style={s.pdcFieldValue}>{toTitleCaseES(data.unidadResponsable)}</Text>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabelBox}>Unidad Administrativa:</Text>
          <Text style={s.pdcFieldValue}>{toTitleCaseES(data.unidadAdministrativa)}</Text>
        </View>

        <View style={s.pdcRegimenRow}>
          <Text style={s.pdcRegimenLabel}>Régimen de Contratación:</Text>
          <View style={s.pdcRegimenBoxes}>
            <Text style={s.pdcCheckLabel}>Honorarios</Text>
            <View style={s.checkboxRect}>{isHonorarios && <Text style={s.checkText}>X</Text>}</View>
            <Text style={{ ...s.pdcCheckLabel, marginLeft: 10 }}>Honorarios Asimilados a Salarios</Text>
            <View style={s.checkboxRect}>{isAsimilados && <Text style={s.checkText}>X</Text>}</View>
          </View>
        </View>

        <Text style={s.pdcFundamentoText}>
          {data.tipoAdministracion === "centralizada"
            ? "Con fundamento en lo dispuesto por los artículos 1, 9, fracción III y 24, fracción XL, de la Ley Orgánica de la Administración Pública para el Estado Libre y Soberano de Morelos, en relación con los numerales 1, 5, fracción XIV, 7, 10, fracción XVII y 23, fracción III, del Reglamento Interior de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal y demás disposiciones jurídicas y administrativas aplicables y una vez realizado el análisis técnico funcional se determina que la Justificación de Prestación de Servicios, relativa a la(s) contratación(es) que se menciona(n), cumple con la metodología y los requisitos establecidos por la Dirección General de Desarrollo Organizacional de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal, por lo que se emite el Dictamen Técnico Funcional de Justificación de Prestación de Servicios:"
            : "Con fundamento en lo dispuesto por los artículos 1, 9, fracción III, 24, fracción XL y 46, de la Ley Orgánica de la Administración Pública para el Estado Libre y Soberano de Morelos, en relación con los numerales 1, 5, fracción XIV, 7, 10, fracción XVII y 23, fracciones IV y VI, del Reglamento Interior de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal y demás disposiciones jurídicas y administrativas aplicables y una vez realizado el análisis técnico funcional se determina que la Justificación de Prestación de Servicios, relativa a la(s) contratación(es) que se menciona(n), cumple con la metodología y los requisitos establecidos por la Dirección General de Desarrollo Organizacional de la Secretaría de Administración y Finanzas del Poder Ejecutivo Estatal, por lo que se emite la Opinión Técnica Funcional de Justificación de Prestación de Servicios:"}
        </Text>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabel}>Tipo de servicios:</Text>
          <Text style={s.pdcFieldValue}>{data.tipoActividades}</Text>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabel}>Clave y nombre del programa{"\n"}o proyecto:</Text>
          <Text style={s.pdcFieldValueMulti}>{data.programaProyecto}</Text>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabel}>Objeto de la contratación:</Text>
          <Text style={s.pdcFieldValueMulti}>{data.objetoContratacion}</Text>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabel}>Importe bruto:</Text>
          <Text style={s.pdcFieldValue}>{data.importeBruto} (mensual)</Text>
        </View>
        <Text style={s.pdcImporteSubText}>
          (El pago se realizará como lo determine la Unidad Administrativa sin exceder el monto total autorizado)
        </Text>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabel}>Justificación:</Text>
          <Text style={s.pdcFieldValue}>{data.clave || ""}</Text>
        </View>

        <View style={s.pdcFieldRow}>
          <Text style={s.pdcFieldLabel}>Número de Prestadores de{"\n"}Servicios:</Text>
          <Text style={s.pdcFieldValue}>{data.numeroPrestadores}</Text>
        </View>

        <View style={s.pdcVigenciaRow}>
          <Text style={s.pdcFieldLabel}>Vigencia del Dictamen:</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <View style={s.pdcVigCellColumn}><Text style={s.pdcVigCellLabel}>Día</Text><View style={s.pdcVigCellBorder}><Text style={s.pdcVigCellValue}>{inD.d}</Text></View></View>
            <View style={s.pdcVigCellColumn}><Text style={s.pdcVigCellLabel}>Mes</Text><View style={s.pdcVigCellBorder}><Text style={s.pdcVigCellValue}>{inD.m}</Text></View></View>
            <View style={s.pdcVigCellColumn}><Text style={s.pdcVigCellLabel}>Año</Text><View style={s.pdcVigCellBorder}><Text style={s.pdcVigCellValue}>{inD.y}</Text></View></View>
            <Text style={{ marginHorizontal: 8, paddingBottom: 2, fontSize: 9 }}>al</Text>
            <View style={s.pdcVigCellColumn}><Text style={s.pdcVigCellLabel}>Día</Text><View style={s.pdcVigCellBorder}><Text style={s.pdcVigCellValue}>{finD.d}</Text></View></View>
            <View style={s.pdcVigCellColumn}><Text style={s.pdcVigCellLabel}>Mes</Text><View style={s.pdcVigCellBorder}><Text style={s.pdcVigCellValue}>{finD.m}</Text></View></View>
            <View style={s.pdcVigCellColumn}><Text style={s.pdcVigCellLabel}>Año</Text><View style={s.pdcVigCellBorder}><Text style={s.pdcVigCellValue}>{finD.y}</Text></View></View>
          </View>
        </View>

        <View style={s.pdcNotaWrapper} wrap={false}>
          <Text style={s.pdcNotaText}>
            Nota: {data.notaDictamen ?? NOTA_DICTAMEN_DEFAULT}
          </Text>
        </View>

        {!data.ocultarFirmas ? (
          <View wrap={false} style={{ marginTop: 20 }}>
            {data.formato === 'en_linea' ? (
              <View style={{ marginBottom: 15, alignItems: 'center' }}>
                <FauxBoldText style={{ fontFamily: FONT_BOLD, fontSize: 10, textAlign: 'center', marginBottom: 4, letterSpacing: 0.6 }}>ATENTAMENTE</FauxBoldText>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, textAlign: 'center', marginBottom: 2, color: '#B00020', letterSpacing: 0.6 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
                <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
                  a través de un certificado reconocido legalmente y tiene, en relación a la información firmada, un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
                </Text>
              </View>
            ) : null}

            <View style={s.firmasDictWrapper} wrap={false}>
              <View style={s.firmaDictBox}>
                <Text style={s.firmaLabel}>Revisó</Text>
                <View style={{ width: "100%", alignItems: "center" }}>
                  <View style={s.firmaLine}></View>
                  <FauxBoldText style={s.firmaNombre}>{data.firmaDictRevisoNombre || ""}</FauxBoldText>
                  <FauxBoldText style={s.firmaDesc}>
                    {data.firmaDictRevisoNombre && data.firmaDictRevisoCargo
                      ? data.firmaDictRevisoCargo
                      : "Nombre y cargo de la Persona responsable de la revisión de la Justificación"}
                  </FauxBoldText>
                </View>
              </View>
              <View style={s.firmaDictBox}>
                <Text style={s.firmaLabel}>Verificó</Text>
                <View style={{ width: "100%", alignItems: "center" }}>
                  <View style={s.firmaLine}></View>
                  <FauxBoldText style={s.firmaNombre}>{data.firmaDictVerificoNombre || ""}</FauxBoldText>
                  <FauxBoldText style={s.firmaDesc}>
                    {data.firmaDictVerificoNombre && data.firmaDictVerificoCargo
                      ? data.firmaDictVerificoCargo
                      : "Nombre y cargo de la Persona Titular de la Dirección de Análisis Normativo y Funcional"}
                  </FauxBoldText>
                </View>
              </View>
              <View style={s.firmaDictBoxLast}>
                <Text style={s.firmaLabel}>Emitió</Text>
                <View style={{ width: "100%", alignItems: "center" }}>
                  <View style={s.firmaLine}></View>
                  <FauxBoldText style={s.firmaNombre}>{data.firmaDictEmitioNombre || ""}</FauxBoldText>
                  <FauxBoldText style={s.firmaDesc}>
                    {data.firmaDictEmitioNombre && data.firmaDictEmitioCargo
                      ? data.firmaDictEmitioCargo
                      : "Nombre y cargo de la Persona Titular de la Dirección General de Desarrollo Organizacional"}
                  </FauxBoldText>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <View style={s.pdcFooterTable} fixed>
          <View style={s.pdcFooterLeft}>
            <Text style={s.pdcFooterLine}>
              <Text style={s.pdcFooterLabelBold}>Formato:</Text> {tituloFormatoDictamen}
            </Text>
            <Text style={s.pdcFooterLine}>
              <Text style={s.pdcFooterLabelBold}>Clave:</Text> DGDO-DDPP-PR01-FO11
            </Text>
            <Text style={s.pdcFooterLine}>
              <Text style={s.pdcFooterLabelBold}>Anexo:</Text> 14
            </Text>
          </View>
          <View style={s.pdcFooterRight}>
            <Text style={s.pdcFooterLine}>
              <Text style={s.pdcFooterLabelBold}>Referencia:</Text> DGDO-DDPP-PR01
            </Text>
            <Text style={s.pdcFooterLine}>
              <Text style={s.pdcFooterLabelBold}>Revisión:</Text> 2
            </Text>
          </View>
        </View>
      </Page>
      )}
    </Document>
  );
}