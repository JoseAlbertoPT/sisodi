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
import { siglasSecretaria } from "@/lib/clave-dictamen";
import { resolveQuetzalliSansPath } from "@/lib/pdf-fonts";

// Mismo glifo de viñeta que la Carta Descriptiva (PlantillaCartaDescriptivaServicios):
// Helvetica no tiene glifo para ❖ (U+2756), así que se registra esta fuente.
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

// Palabras que se mantienen en minúscula (salvo cuando son la primera palabra).
const PALABRAS_MENORES = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "u",
  "en", "a", "al", "con", "por", "para",
]);

// Convierte un texto (normalmente en MAYÚSCULAS) a formato tipo título en español.
// Ej.: ÓRGANO DESCONCENTRADO DENOMINADO "HÁBITAT MORELOS"
//   -> Órgano Desconcentrado Denominado "Hábitat Morelos"
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

export interface JustificacionNombramientoData {
  tipoAdministracion: 'centralizada' | 'paraestatal';
  formato: 'fisico' | 'en_linea';
  oficioSolicitud: string;
  secretaria: string;
  unidadAdministrativa: string;
  unidadResponsable: string;
  programaProyecto: string;
  denominacionNombramiento: string;
  tipoActividad: string;
  puestoJefeInmediato: string;
  numeroPersonas: number;
  importeNetoMensual: string;
  tipoPago: string;
  equivalenciaNivel: string;
  vigenciaInicio: string;
  vigenciaTermino: string;
  clavePresupuestal: string;
  renovacion: boolean;
  folioAnterior?: string;

  objetoNombramiento: string;
  funcionesPrincipales: string[];
  responsabilidades: string[];
  marcoNormativo: string[];

  condiciones: {
    cambioDomicilio: boolean;
    horario: boolean;
    viajar: boolean;
  };
  riesgos: {
    caidas: 'Bajo' | 'Medio' | 'Alto' | '';
    mutilaciones: 'Bajo' | 'Medio' | 'Alto' | '';
    golpes: 'Bajo' | 'Medio' | 'Alto' | '';
    otros: 'Bajo' | 'Medio' | 'Alto' | '';
  };
  
  resguardoActivos: boolean;

  perfil: {
    escolaridadMinima: string[];
    competenciasAdministrativas: string[];
    competenciasTecnicas: string[];
    competenciasSociales: string[];
    valores: string[];
    areasExperiencia: string[];
    aniosExperiencia: string;
  };
  firmaElaboroNombre?: string;
  firmaRevisoNombre?: string;
  firmaVoBoJuridicoNombre?: string;
  firmaDictRevisoNombre?: string;
  firmaDictVerificoNombre?: string;
  firmaDictEmitioNombre?: string;
  fechaDictaminacion?: string;
  ocultarFirmas?: boolean;
  clave?: string;
  notaDictamen?: string;
  // Ver PlantillaJustificacionServicios: la página de Opinión/Dictamen solo debe
  // salir cuando ese dictamen ya existe. Default true para no romper llamadores
  // existentes (firma, catálogo histórico) que sí siempre la esperan.
  incluirPaginaDictamen?: boolean;
}

// Debe coincidir con NOTA_DICTAMEN_DEFAULT en lib/configuracion-texto.ts;
// se duplica aquí (en vez de importarla) para no acoplar esta plantilla,
// que solo debe depender de @react-pdf/renderer, al cliente de Prisma.
const NOTA_DICTAMEN_DEFAULT =
  "Esta Dirección General únicamente dictamina sobre la funcionalidad de las actividades conforme con la metodología establecida y queda fuera de sus atribuciones la distribución y ejecución de los recursos para el pago de las contrataciones, en las cuales se deberá observar lo dispuesto por el Artículo Quinto del Presupuesto de Egresos del Gobierno del Estado de Morelos para el ejercicio fiscal 2026 y demás normatividad aplicable.";

const LOGO_FINANZAS = fs.readFileSync(path.join(process.cwd(), "public/logo-20finanzas.png"));
const MARCA_MORELOS = fs.readFileSync(path.join(process.cwd(), "public/LOGO_MORELOS_V1.png"));

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40,
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
    opacity: 0.22,
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
    marginBottom: 36,
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
  claveBox: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  pageBox: { flex: 1, paddingHorizontal: 4, paddingTop: 10, justifyContent: "flex-start", alignItems: "center" },
  claveText: { fontSize: 8, textAlign: "center" },

  fechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 26 },
  centeredTitle: { fontFamily: FONT_BOLD, fontSize: 10, textAlign: "center", marginBottom: 14 , letterSpacing: 0.6},
  sectionTitle: { fontFamily: FONT_BOLD, fontSize: 10, marginBottom: 8, marginTop: 10 , letterSpacing: 0.6},

  // flex-start (no flex-end): si el valor hace wrap a 2 renglones (p. ej.
  // Programa o Proyecto), la etiqueta debe alinearse con el primer renglón,
  // no con el último.
  row: { flexDirection: "row", marginBottom: 12, alignItems: "flex-start" },
  bold: { fontFamily: FONT_BOLD, marginBottom: 3, marginTop: 3 , letterSpacing: 0.6},
  numLabel: { width: 15, fontFamily: FONT_BOLD, fontSize: 9 },
  marginLabel: { fontFamily: FONT_BOLD, marginRight: 5, fontSize: 9 },
  valueText: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    fontFamily: FONT_REGULAR,
    paddingBottom: 2,
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
  checkText: { fontSize: 8, fontFamily: FONT_BOLD },

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

  tableBorder: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 10,
  },
  tableHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableColHead: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  tableColHeadText: {
    fontFamily: FONT_BOLD,
    fontSize: 8,
    textAlign: "center",
  },
  tableCol: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
    justifyContent: "center",
  },
  tableColNoBorder: {
    padding: 4,
    justifyContent: "center",
  },

  listItemContainer: { flexDirection: "row", marginBottom: 6, paddingLeft: 10, marginTop: 2 },
  listNum: { width: 18, fontFamily: FONT_BOLD },
  listTextWrap: { flex: 1, textAlign: "justify", lineHeight: 1.5 },
  bulletItemContainer: { flexDirection: "row", marginBottom: 2, paddingLeft: 15, marginTop: 1 },
  bulletSign: { width: 18, fontSize: 7, fontFamily: "NotoSymbols" },

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
  firmaLabel: { fontSize: 8, marginBottom: 5, textAlign: "center" },
  firmaNombre: { fontSize: 9, fontFamily: FONT_BOLD, textAlign: "center", marginBottom: 5, minHeight: 12 , letterSpacing: 0.6},
  firmaDesc: {
    fontFamily: FONT_BOLD,
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.3,
    letterSpacing: 0.6,
  },

  dictTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 10,
    textAlign: "center",
    marginBottom: 10,
    marginTop: 5,
    letterSpacing: 0.6,
  },
  dictP: {
    fontSize: 9,
    textAlign: "justify",
    lineHeight: 1.4,
    marginBottom: 15,
  },
  dictRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
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
    height: 120,
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

export function PlantillaNombramientoDeterminado({ data }: { data: JustificacionNombramientoData }) {
  const inD = parseDateParts(data.vigenciaInicio);
  const finD = parseDateParts(data.vigenciaTermino);

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
            <Text style={s.headerTitle}>JUSTIFICACIÓN PARA NOMBRAMIENTO POR TIEMPO{"\n"}DETERMINADO</Text>
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
          <Text style={{ fontFamily: FONT_BOLD, marginTop: 5, marginBottom: 5 }}>Fecha de elaboración de la Justificación: </Text>
          <Text style={{ borderBottomWidth: 1, minWidth: 100, textAlign: "center", marginTop: 5, marginBottom: 5 }}>
            {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
          </Text>
        </View>

        <Text style={s.centeredTitle}>JUSTIFICACIÓN PARA NOMBRAMIENTO POR TIEMPO DETERMINADO</Text>

        <Text style={s.sectionTitle}>I.    DATOS GENERALES:</Text>

        <View style={s.row}>
          <Text style={s.numLabel}>1.</Text>
          <Text style={s.marginLabel}>Secretaría/Subsecretaría/Dependencia/Organismo Auxiliar:</Text>
          <Text style={s.valueText}>{toTitleCaseES(data.secretaria)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>2.</Text>
          <Text style={s.marginLabel}>Unidad Administrativa de adscripción:</Text>
          <Text style={s.valueText}>{toTitleCaseES(data.unidadAdministrativa)}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>3.</Text>
          <Text style={s.marginLabel}>Unidad Responsable del Gasto:</Text>
          <Text style={s.valueText}>{toTitleCaseES(data.unidadResponsable)}</Text>
        </View>


        <Text style={{ fontSize: 9, marginBottom: 12 }}>
          <Text style={s.numLabel}>4. </Text>
          <Text style={{ ...s.marginLabel, marginRight: 0 }}>Programa o Proyecto:  </Text>
          <Text style={s.valueText}>{data.programaProyecto}</Text>
        </Text>

        <View style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={s.numLabel}>5.</Text>
            <Text style={{ ...s.marginLabel, width: 145 }}>Denominación del Nombramiento:</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#000", minHeight: 14 }}>
              <Text style={{ fontSize: 9, fontFamily: FONT_REGULAR, paddingBottom: 2 }}>
                {data.denominacionNombramiento || ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Text style={s.numLabel}>6.</Text>
            <Text style={{ ...s.marginLabel, width: 90 }}>Tipo de Actividad:</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: "#000", minHeight: 14 }}>
              <Text style={{ fontSize: 9, fontFamily: FONT_REGULAR, paddingBottom: 2 }}>
                {data.tipoActividad || ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>7.</Text>
          <Text style={s.marginLabel}>Puesto del Jefe Inmediato:</Text>
          <Text style={s.valueText}>{data.puestoJefeInmediato}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>8.</Text>
          <Text style={s.marginLabel}>Número de personas a contratar:</Text>
          <Text style={s.valueText}>{data.numeroPersonas || ""}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>9.</Text>
          <Text style={s.marginLabel}>Importe Neto:</Text>
          <Text style={s.valueText}>{data.importeNetoMensual}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>10.</Text>
          <Text style={s.marginLabel}>Tipo de Pago:</Text>
          <Text style={s.valueText}>{data.tipoPago}</Text>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 6, alignItems: "flex-end" }}>
          <Text style={s.numLabel}>11.</Text>
          <Text style={s.marginLabel}>Equivalencia de Acuerdo al Tabulador de Sueldos del Poder Ejecutivo, vigente:</Text>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 7 }}>Nivel y categoría</Text>
            <Text style={{ borderBottomWidth: 1, borderBottomColor: "#000", width: "100%", textAlign: "center" }}>{data.equivalenciaNivel}</Text>
          </View>
        </View>

        <View style={{ ...s.row, alignItems: "flex-end", marginTop: 5 }}>
          <Text style={s.numLabel}>12.</Text>
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


        <View wrap={false}>
          <Text style={s.sectionTitle}>I.1    OBJETO DEL NOMBRAMIENTO POR TIEMPO DETERMINADO:</Text>
          <Text style={{ fontSize: 9, textAlign: "justify", lineHeight: 1.15, marginBottom: 10, marginTop: 4 }} wrap={true}>
            {data.objetoNombramiento}
          </Text>
        </View>

        <View wrap={false}>
          <Text style={s.sectionTitle}>I.2    FUNCIONES PRINCIPALES:</Text>
          {data.funcionesPrincipales?.slice(0, 1).map((act, index) => (
            <View key={`fun-${index}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 1}.</Text>
              <Text style={s.listTextWrap} wrap={true}>{act}</Text>
            </View>
          ))}
        </View>
        {data.funcionesPrincipales?.slice(1).map((act, index) => (
          <View key={`fun-${index + 1}`} style={s.listItemContainer} wrap={false}>
            <Text style={s.listNum}>{index + 2}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{act}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={s.sectionTitle}>I.3    RESPONSABILIDADES:</Text>
          {data.responsabilidades?.slice(0, 1).map((resp, index) => (
            <View key={`res-${index}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 1}.</Text>
              <Text style={s.listTextWrap} wrap={true}>{resp}</Text>
            </View>
          ))}
        </View>
        {data.responsabilidades?.slice(1).map((resp, index) => (
          <View key={`res-${index + 1}`} style={s.listItemContainer} wrap={false}>
            <Text style={s.listNum}>{index + 2}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{resp}</Text>
          </View>
        ))}

        <View style={{ marginTop: 10 }} wrap={false}>
          <Text style={s.sectionTitle}>I.4    MARCO NORMATIVO, LEGAL Y ADMINISTRATIVO APLICABLE:</Text>
          {data.marcoNormativo?.slice(0, 1).map((leg, index) => (
            <View key={`leg-${index}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 1}.</Text>
              <Text style={s.listTextWrap} wrap={true}>{leg}</Text>
            </View>
          ))}
        </View>

        {data.marcoNormativo?.slice(1, -1).map((leg, index) => (
          <View key={`leg-${index + 1}`} style={s.listItemContainer} wrap={false}>
            <Text style={s.listNum}>{index + 2}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{leg}</Text>
          </View>
        ))}

        <View wrap={false}>
          {data.marcoNormativo && data.marcoNormativo.length > 1 && (
            <View style={s.listItemContainer}>
              <Text style={s.listNum}>{data.marcoNormativo.length}.</Text>
              <Text style={s.listTextWrap} wrap={true}>{data.marcoNormativo[data.marcoNormativo.length - 1]}</Text>
            </View>
          )}

          {data.formato === 'en_linea' && (
            <View style={{ marginTop: 20, marginBottom: 15, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, textAlign: 'center', marginBottom: 4, letterSpacing: 0.6 }}>ATENTAMENTE</Text>
              <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, textAlign: 'center', marginBottom: 2, color: '#B00020', letterSpacing: 0.6 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
              <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
                a través de un certificado reconocido legalmente y tiene, en relación a la información firmada un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
              </Text>
            </View>
          )}

          {!data.ocultarFirmas ? (
            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: data.formato === 'en_linea' ? 10 : 30 }}>
              <View style={{ width: "45%", alignItems: "center" }}>
                <Text style={{ fontSize: 8, marginBottom: 5, fontFamily: FONT_BOLD, letterSpacing: 0.6 }}>Vo. Bo. Marco Normativo</Text>
                <Text style={s.firmaNombre}>{data.firmaVoBoJuridicoNombre || ""}</Text>
                <View style={{ borderTopWidth: 1, borderTopColor: "#000", width: "100%", marginBottom: 4 }}></View>
                <Text style={{ fontSize: 7, textAlign: "center", fontFamily: FONT_BOLD, letterSpacing: 0.6 }}>Titular de la Unidad de Enlace</Text>
                <Text style={{ fontSize: 7, textAlign: "center", fontFamily: FONT_BOLD, letterSpacing: 0.6 }}>Jurídico o Equivalente</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 10 }}>I.5    CONDICIONES Y RIESGOS DE TRABAJO:</Text>

          <View style={s.tableBorder}>
            <View style={{ ...s.tableHeader, backgroundColor: "#fff" }}>
              <Text style={s.tableColHeadText}>DISPONIBILIDAD DE:</Text>
            </View>
            <View style={s.tableRowLast}>
              <View style={{ ...s.tableCol, width: "33%", flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 8 }}>Cambio de domicilio</Text>
                <Text style={{ fontSize: 8, marginLeft: 5 }}>Sí</Text>
                <View style={s.checkboxRect}>{data.condiciones?.cambioDomicilio && <Text style={s.checkText}>X</Text>}</View>
                <Text style={{ fontSize: 8, marginLeft: 5 }}>No</Text>
                <View style={s.checkboxRect}>{!data.condiciones?.cambioDomicilio && <Text style={s.checkText}>X</Text>}</View>
              </View>
              <View style={{ ...s.tableCol, width: "33%", flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 8 }}>Horario</Text>
                <Text style={{ fontSize: 8, marginLeft: 5 }}>Sí</Text>
                <View style={s.checkboxRect}>{data.condiciones?.horario && <Text style={s.checkText}>X</Text>}</View>
                <Text style={{ fontSize: 8, marginLeft: 5 }}>No</Text>
                <View style={s.checkboxRect}>{!data.condiciones?.horario && <Text style={s.checkText}>X</Text>}</View>
              </View>
              <View style={{ ...s.tableColNoBorder, width: "34%", flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 8 }}>Viajar</Text>
                <Text style={{ fontSize: 8, marginLeft: 5 }}>Sí</Text>
                <View style={s.checkboxRect}>{data.condiciones?.viajar && <Text style={s.checkText}>X</Text>}</View>
                <Text style={{ fontSize: 8, marginLeft: 5 }}>No</Text>
                <View style={s.checkboxRect}>{!data.condiciones?.viajar && <Text style={s.checkText}>X</Text>}</View>
              </View>
            </View>
          </View>

          <View style={[s.tableBorder, { marginTop: 5 }]}>
            <View style={{ ...s.tableHeader, backgroundColor: "#fff" }}>
              <Text style={s.tableColHeadText}>EXPOSICIÓN A RIESGOS DE TRABAJO:</Text>
            </View>
            <View style={s.tableRow}>
              <View style={{ ...s.tableCol, width: "25%" }}></View>
              <View style={{ ...s.tableColHead, width: "75%", borderRightWidth: 0, flexDirection: "row", justifyContent: "space-around" }}>
                <Text style={{ fontSize: 8 }}>Frecuencia</Text>
              </View>
            </View>
            <View style={s.tableRow}>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8, fontFamily: FONT_BOLD, textAlign: "center" }}>Lesiones</Text></View>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8, textAlign: "center" }}>Bajo</Text></View>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8, textAlign: "center" }}>Medio</Text></View>
              <View style={{ ...s.tableColNoBorder, width: "25%" }}><Text style={{ fontSize: 8, textAlign: "center" }}>Alto</Text></View>
            </View>
            <View style={s.tableRow}>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8 }}>Caidas</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.caidas === 'Bajo' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.caidas === 'Medio' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableColNoBorder, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.caidas === 'Alto' ? 'X' : ''}</Text></View>
            </View>
            <View style={s.tableRow}>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8 }}>Mutilaciones</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.mutilaciones === 'Bajo' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.mutilaciones === 'Medio' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableColNoBorder, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.mutilaciones === 'Alto' ? 'X' : ''}</Text></View>
            </View>
            <View style={s.tableRow}>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8 }}>Golpes</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.golpes === 'Bajo' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.golpes === 'Medio' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableColNoBorder, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.golpes === 'Alto' ? 'X' : ''}</Text></View>
            </View>
            <View style={s.tableRowLast}>
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8 }}>Otros</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.otros === 'Bajo' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableCol, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.otros === 'Medio' ? 'X' : ''}</Text></View>
              <View style={{ ...s.tableColNoBorder, width: "25%", alignItems: "center" }}><Text>{data.riesgos?.otros === 'Alto' ? 'X' : ''}</Text></View>
            </View>
          </View>
        </View>

        <Text style={{...s.sectionTitle, marginTop: 10}}>I.6    RESGUARDO PERSONALIZADO DE ACTIVOS:</Text>
        <View style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
          <Text style={{ fontSize: 9, marginLeft: 15 }}>Sí</Text>
          <View style={s.checkboxRect}>{data.resguardoActivos && <Text style={s.checkText}>X</Text>}</View>
          <Text style={{ fontSize: 9, marginLeft: 20 }}>No</Text>
          <View style={s.checkboxRect}>{!data.resguardoActivos && <Text style={s.checkText}>X</Text>}</View>
        </View>
        <Text style={{ fontSize: 9, textAlign: "justify", marginBottom: 5 }}>
          En el caso de la Administración Pública Centralizada, se estará a lo que establezca el formato de Resguardo Personalizado de Activos de bienes muebles e intangibles, emitido por la Dirección General de Patrimonio de la Secretaría de Administración y Finanzas, que señala las obligaciones, como resguardante de los Activos.
        </Text>
        <Text style={{ fontSize: 9, textAlign: "justify", marginBottom: 15 }}>
          En el caso de Organismos Auxiliares, se estará a lo establecido por sus disposiciones administrativas correspondientes.
        </Text>

        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 15 }}>II.  PERFIL:</Text>
          <Text style={{ marginBottom: 8, fontSize: 8 }}>(Se refiere a la escolaridad, competencias y experiencia, necesarios para ocupar el puesto).</Text>

          <Text style={{ ...s.bold, marginBottom: 10 }}>II.1    ESCOLARIDAD MÍNIMA:</Text>
          {data.perfil?.escolaridadMinima?.slice(0, 1).map((esc, i) => (
            <View key={`esc-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap} wrap={true}>{esc}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.escolaridadMinima?.slice(1).map((esc, i) => (
          <View key={`esc-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap} wrap={true}>{esc}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginTop: 10, marginBottom: 12 }}>II.2    COMPETENCIAS LABORALES REQUERIDAS:</Text>
          <Text style={{ fontFamily: FONT_BOLD, marginTop: 3, marginLeft: 15, marginBottom: 2, letterSpacing: 0.6 }}>II.2.1  Administrativas:</Text>
          {data.perfil?.competenciasAdministrativas?.slice(0, 1).map((comp, i) => (
            <View key={`ca-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasAdministrativas?.slice(1).map((comp, i) => (
          <View key={`ca-${i + 1}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ fontFamily: FONT_BOLD, marginTop: 8, marginLeft: 15, marginBottom: 6, letterSpacing: 0.6 }}>II.2.2  Técnicas:</Text>
          {data.perfil?.competenciasTecnicas?.slice(0, 1).map((comp, i) => (
            <View key={`ct-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasTecnicas?.slice(1).map((comp, i) => (
          <View key={`ct-${i + 1}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ fontFamily: FONT_BOLD, marginTop: 8, marginLeft: 15, marginBottom: 6, letterSpacing: 0.6 }}>II.2.3  Sociales:</Text>
          {data.perfil?.competenciasSociales?.slice(0, 1).map((comp, i) => (
            <View key={`cs-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasSociales?.slice(1).map((comp, i) => (
          <View key={`cs-${i + 1}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ fontFamily: FONT_BOLD, marginTop: 3, marginLeft: 15, marginBottom: 2, letterSpacing: 0.6 }}>II.2.4  Valores:</Text>
          {data.perfil?.valores?.slice(0, 1).map((val, i) => (
            <View key={`val-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}}>
              <Text style={s.bulletSign}>{"❖"}</Text>
              <Text style={s.listTextWrap} wrap={true}>{val}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.valores?.slice(1).map((val, i) => (
          <View key={`val-${i + 1}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{"❖"}</Text>
            <Text style={s.listTextWrap} wrap={true}>{val}</Text>
          </View>
        ))}

        <View style={{ flexDirection: "row", marginTop: 10 }} wrap={false}>
          <View style={{ width: "50%" }}>
            <Text style={s.bold}>II.3    ÁREAS DE EXPERIENCIA:</Text>
            {data.perfil?.areasExperiencia?.map((area, i) => (
              <View key={`ae-${i}`} style={{...s.bulletItemContainer}} wrap={false}>
                <Text style={s.bulletSign}>{"❖"}</Text>
                <Text style={s.listTextWrap} wrap={true}>{area}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: "50%" }}>
            <Text style={s.bold}>AÑOS DE EXPERIENCIA:</Text>
            <Text style={{ marginTop: 3, marginLeft: 15 }}>{data.perfil?.aniosExperiencia}</Text>
          </View>
        </View>


        {!data.ocultarFirmas ? <View style={{ flex: 1 }} /> : null}

        {!data.ocultarFirmas ? (
          <View>
            {data.formato === 'en_linea' ? (
              <View style={{ marginBottom: 15, alignItems: 'center' }} wrap={false}>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, textAlign: 'center', marginBottom: 4, letterSpacing: 0.6 }}>ATENTAMENTE</Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, textAlign: 'center', marginBottom: 2, color: '#B00020', letterSpacing: 0.6 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
                <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
                  a través de un certificado reconocido legalmente y tiene, en relación a la información firmada un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
                </Text>
              </View>
            ) : null}
            <View style={s.firmasWrapper} wrap={false}>
              <View style={s.firmaBox}>
                <Text style={s.firmaLabel}>Elaboró</Text>
                <Text style={s.firmaNombre}>{data.firmaElaboroNombre || ""}</Text>
                <View style={s.firmaLine}></View>
                <Text style={s.firmaDesc}>Nombre y cargo de la</Text>
                <Text style={s.firmaDesc}>Persona Titular de la Unidad Administrativa u Organismo Auxiliar</Text>
              </View>
              <View style={s.firmaBox}>
                <Text style={s.firmaLabel}>Revisó</Text>
                <Text style={s.firmaNombre}>{data.firmaRevisoNombre || ""}</Text>
                <View style={s.firmaLine}></View>
                <Text style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la</Text>
                <Text style={s.firmaDesc}>Unidad de Enlace Financiero Administrativo o Equivalente</Text>
              </View>
            </View>
          </View>
        ) : null}

      </Page>

      {(data.incluirPaginaDictamen ?? true) && (
      <Page size="LETTER" style={s.page}>
        <View style={s.pageFrame} fixed />
        <View style={s.watermarkContainer} fixed>
          <Image src={MARCA_MORELOS} style={s.watermarkImage} />
        </View>

        <View style={s.headerTable} fixed>
          <View style={s.headerCol1}>
            <Image src={LOGO_FINANZAS} style={s.logo} />
          </View>
          <View style={s.headerCol2}>
            <Text style={s.headerTitle}>JUSTIFICACIÓN PARA NOMBRAMIENTO POR TIEMPO{"\n"}DETERMINADO</Text>
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

        {data.tipoAdministracion === "centralizada" ? (
          <>
            <Text style={s.dictTitle}>DICTAMINACIÓN TÉCNICA FUNCIONAL DE JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS PROFESIONALES{"\n"}(ÁREA EXCLUSIVA PARA LA DIRECCIÓN GENERAL DE DESARROLLO ORGANIZACIONAL)</Text>
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
          <Text style={{ fontSize: 9, fontFamily: FONT_BOLD }}>Dictamen Técnico Funcional: </Text>
          <View style={s.checkboxRect}>
            {data.tipoAdministracion === "centralizada" && <Text style={s.checkText}>X</Text>}
          </View>
          <Text style={{ fontSize: 9, fontFamily: FONT_BOLD, marginLeft: 30 }}>Opinión Técnica Funcional: </Text>
          <View style={s.checkboxRect}>
            {data.tipoAdministracion === "paraestatal" && <Text style={s.checkText}>X</Text>}
          </View>
        </View>

        <View style={s.dictBox} wrap={false}>
          <View style={s.dictBoxRow1}>
            <View style={s.dictBoxLeft}>
              <Text style={{ fontSize: 9 }}>Fecha de dictaminación:</Text>
              {data.fechaDictaminacion && (
                <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, marginTop: 8 }}>
                  {data.fechaDictaminacion}
                </Text>
              )}
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
            <Text style={{ fontSize: 10, fontFamily: FONT_BOLD, marginBottom: 4, letterSpacing: 0.6 }}>Nota:</Text>
            <Text style={{ fontSize: 8, textAlign: "justify", lineHeight: 1.4 }}>
              {data.notaDictamen ?? NOTA_DICTAMEN_DEFAULT}
            </Text>
          </View>
        </View>

        {!data.ocultarFirmas ? <View style={{ flex: 1 }} /> : null}

        {!data.ocultarFirmas ? (
          <View>
            {data.formato === 'en_linea' ? (
              <View style={{ marginBottom: 15, alignItems: 'center' }} wrap={false}>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 10, textAlign: 'center', marginBottom: 4, letterSpacing: 0.6 }}>ATENTAMENTE</Text>
                <Text style={{ fontFamily: FONT_BOLD, fontSize: 9, textAlign: 'center', marginBottom: 2, color: '#B00020', letterSpacing: 0.6 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
                <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
                  a través de un certificado reconocido legalmente y tiene, en relación a la información firmada un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
                </Text>
              </View>
            ) : null}
            <View style={s.firmasDictWrapper} wrap={false}>
              <View style={s.firmaDictBox}>
                <Text style={s.firmaLabel}>Revisó</Text>
                <Text style={s.firmaNombre}>{data.firmaDictRevisoNombre || ""}</Text>
                <View style={s.firmaLine}></View>
                <Text style={s.firmaDesc}>Nombre y cargo de la Persona responsable de la revisión de la Justificación</Text>
              </View>
              <View style={s.firmaDictBox}>
                <Text style={s.firmaLabel}>Verificó</Text>
                <Text style={s.firmaNombre}>{data.firmaDictVerificoNombre || ""}</Text>
                <View style={s.firmaLine}></View>
                <Text style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la Dirección de Análisis Normativo y Funcional</Text>
              </View>
              <View style={s.firmaDictBox}>
                <Text style={s.firmaLabel}>Emitió</Text>
                <Text style={s.firmaNombre}>{data.firmaDictEmitioNombre || ""}</Text>
                <View style={s.firmaLine}></View>
                <Text style={s.firmaDesc}>Nombre y cargo de la Persona Titular de la Dirección General de Desarrollo Organizacional</Text>
              </View>
            </View>
          </View>
        ) : null}

      </Page>
      )}
    </Document>
  );
}
