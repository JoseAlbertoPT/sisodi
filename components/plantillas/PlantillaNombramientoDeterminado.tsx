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
   INTERFACE DE DATOS (Alineada al PDF FINANZAS.pdf)
   ═══════════════════════════════════════════════════════════ */
export interface JustificacionNombramientoData {
  tipoAdministracion: 'centralizada' | 'paraestatal';
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
  
  // Desarrollo del cuerpo
  objetoNombramiento: string;
  funcionesPrincipales: string[];
  responsabilidades: string[];
  marcoNormativo: string[];
  
  // Condiciones y riesgos
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
  
  // Perfil
  perfil: {
    escolaridadMinima: string[];
    competenciasAdministrativas: string[];
    competenciasTecnicas: string[];
    competenciasSociales: string[];
    valores: string[];
    areasExperiencia: string[];
    aniosExperiencia: string;
  };
}

/* ═══════════════════════════════════════════════════════════
   ASSETS
   ═══════════════════════════════════════════════════════════ */
const LOGO_FINANZAS = path.join(process.cwd(), "public/logo-20finanzas.png");
const MARCA_MORELOS = path.join(process.cwd(), "public/LOGO_MORELOS_V1.png");

/* ═══════════════════════════════════════════════════════════
   ESTILOS CORREGIDOS (Formato Oficial)
   ═══════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 40, // Sin footer, se reduce un poco el bottom padding
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
    opacity: 0.15,
    zIndex: -1,
  },
  watermarkImage: { 
    width: 600,
    height: "auto",
    transform: 'scale(2.0)', 
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
  // La caja Clave se eliminó como lo solicitaron, ahora la paginación toma todo el alto
  pageBox: { flex: 1, padding: 4, justifyContent: "center", alignItems: "center" },
  claveText: { fontSize: 8, textAlign: "center" },

  /* --- Elementos de página --- */
  fechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 15 },
  centeredTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", marginBottom: 10 },
  // Espaciado ajustado requerido: marginTop 5, marginBottom 5
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 5, marginTop: 5 },

  /* --- Filas de Formulario (campos 1-14) --- */
  row: { flexDirection: "row", marginBottom: 6, alignItems: "flex-end" },
  bold: { fontFamily: "Helvetica-Bold", marginBottom: 5, marginTop: 5 },
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

  /* --- Tablas (Condiciones y Riesgos) --- */
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
    fontFamily: "Helvetica-Bold",
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

  /* --- Listas Dinámicas (Wraps) - Numeración --- */
  listItemContainer: { flexDirection: "row", marginBottom: 6, paddingLeft: 10, marginTop: 5 },
  listNum: { width: 18, fontFamily: "Helvetica-Bold" },
  listTextWrap: { flex: 1, textAlign: "justify", lineHeight: 1.3 },
  // Se usará también para perfil
  bulletItemContainer: { flexDirection: "row", marginBottom: 4, paddingLeft: 15, marginTop: 3 },
  bulletSign: { width: 18, fontFamily: "Helvetica-Bold" },

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
    marginBottom: 10,
    marginTop: 5,
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
export function PlantillaNombramientoDeterminado({ data }: { data: JustificacionNombramientoData }) {
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
            <Text style={s.headerTitle}>JUSTIFICACIÓN PARA NOMBRAMIENTO POR TIEMPO{"\n"}DETERMINADO</Text>
          </View>
          <View style={s.headerCol3}>
            <View style={s.pageBox}>
              <Text style={s.claveText} render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`} />
            </View>
          </View>
        </View>

        {/* No Footer requerido */}

        {/* ══════════════════════════════════════════════
           PÁGINA 1: DATOS GENERALES
           ══════════════════════════════════════════════ */}

        <View style={s.fechaRow}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 5, marginBottom: 5 }}>Fecha de elaboración de la Justificación: </Text>
          <Text style={{ borderBottomWidth: 1, minWidth: 100, textAlign: "center", marginTop: 5, marginBottom: 5 }}>
            {new Date().toLocaleDateString("es-MX")}
          </Text>
        </View>

        <Text style={s.centeredTitle}>JUSTIFICACIÓN PARA NOMBRAMIENTO POR TIEMPO DETERMINADO</Text>

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
          <Text style={s.marginLabel}>Unidad Administrativa de adscripción:</Text>
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

        {/* Campo 5: Denominación */}
        <View style={s.row}>
          <Text style={s.numLabel}>5.</Text>
          <Text style={s.marginLabel}>Denominación del Nombramiento:</Text>
          <Text style={s.valueText}>{data.denominacionNombramiento}</Text>
        </View>

        {/* Campo 6: Tipo de Actividad */}
        <View style={s.row}>
          <Text style={s.numLabel}>6.</Text>
          <Text style={s.marginLabel}>Tipo de Actividad:</Text>
          <Text style={s.valueText}>{data.tipoActividad}</Text>
        </View>

        {/* Campo 7: Puesto del Jefe Inmediato */}
        <View style={s.row}>
          <Text style={s.numLabel}>7.</Text>
          <Text style={s.marginLabel}>Puesto del Jefe Inmediato:</Text>
          <Text style={s.valueText}>{data.puestoJefeInmediato}</Text>
        </View>

        {/* Campo 8: Número de personas */}
        <View style={s.row}>
          <Text style={s.numLabel}>8.</Text>
          <Text style={s.marginLabel}>Número de personas a contratar:</Text>
          <Text style={s.valueText}>{data.numeroPersonas || ""}</Text>
        </View>
        
        {/* Campo 9: Importe Neto */}
        <View style={s.row}>
          <Text style={s.numLabel}>9.</Text>
          <Text style={s.marginLabel}>Importe Neto:</Text>
          <Text style={s.valueText}>{data.importeNetoMensual}</Text>
        </View>

        {/* Campo 10: Tipo de Pago */}
        <View style={s.row}>
          <Text style={s.numLabel}>10.</Text>
          <Text style={s.marginLabel}>Tipo de Pago:</Text>
          <Text style={s.valueText}>{data.tipoPago}</Text>
        </View>

        {/* Campo 11 - Equivalencia (Dos líneas) */}
        <View style={{ flexDirection: "row", marginBottom: 6, alignItems: "flex-end" }}>
          <Text style={s.numLabel}>11.</Text>
          <Text style={s.marginLabel}>Equivalencia de Acuerdo al Tabulador de Sueldos del Poder Ejecutivo, vigente:</Text>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 7 }}>Nivel y categoría</Text>
            <Text style={{ borderBottomWidth: 1, borderBottomColor: "#000", width: "100%", textAlign: "center" }}>{data.equivalenciaNivel}</Text>
          </View>
        </View>

        {/* Campo 12: Vigencia con Cajas */}
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


        {/* I.1 OBJETO DEL NOMBRAMIENTO POR TIEMPO DETERMINADO */}
        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 15 }}>I.1    OBJETO DEL NOMBRAMIENTO POR TIEMPO DETERMINADO:</Text>
          <Text style={{ textAlign: "justify", lineHeight: 1.3, marginBottom: 10, marginTop: 5 }} wrap={true}>
            {data.objetoNombramiento}
          </Text>
        </View>

        {/* I.2 FUNCIONES PRINCIPALES */}
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

        {/* I.3 RESPONSABILIDADES */}
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

        {/* I.4 MARCO NORMATIVO, LEGAL Y ADMINISTRATIVO APLICABLE */}
        <View style={{ marginTop: 10 }} wrap={false}>
          <Text style={s.sectionTitle}>I.4    MARCO NORMATIVO, LEGAL Y ADMINISTRATIVO APLICABLE:</Text>
          {data.marcoNormativo?.slice(0, 1).map((leg, index) => (
            <View key={`leg-${index}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 1}.</Text>
              <Text style={s.listTextWrap} wrap={true}>{leg}</Text>
            </View>
          ))}
          {data.marcoNormativo?.slice(1).map((leg, index) => (
            <View key={`leg-${index + 1}`} style={s.listItemContainer}>
              <Text style={s.listNum}>{index + 2}.</Text>
              <Text style={s.listTextWrap} wrap={true}>{leg}</Text>
            </View>
          ))}

          {/* Bloque de firma CENTRADO debajo del texto */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
            <View style={{ width: "45%", alignItems: "center" }}>
              <Text style={{ fontSize: 8, marginBottom: 35, fontFamily: "Helvetica-Bold" }}>Vo. Bo. Marco Normativo</Text>
              <View style={{ borderTopWidth: 1, borderTopColor: "#000", width: "100%", marginBottom: 4 }}></View>
              <Text style={{ fontSize: 7, textAlign: "center", fontFamily: "Helvetica-Bold" }}>Titular de la Unidad de Enlace</Text>
              <Text style={{ fontSize: 7, textAlign: "center", fontFamily: "Helvetica-Bold" }}>Jurídico o Equivalente</Text>
            </View>
          </View>
        </View>

        <View wrap={false}>
          {/* I.5 CONDICIONES Y RIESGOS DE TRABAJO */}
          <Text style={{ ...s.sectionTitle, marginTop: 10 }}>I.5    CONDICIONES Y RIESGOS DE TRABAJO:</Text>
          
          {/* Tabla Condiciones */}
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

          {/* Tabla Exposición a Riesgos */}
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
              <View style={{ ...s.tableCol, width: "25%" }}><Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center" }}>Lesiones</Text></View>
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

        {/* I.6 RESGUARDO PERSONALIZADO DE ACTIVOS */}
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

        {/* ── II. PERFIL ── */}
        <Text style={{ ...s.sectionTitle, marginTop: 15 }}>II.  PERFIL:</Text>
        <Text style={{ marginBottom: 5, fontSize: 8 }}>(Se refiere a la escolaridad, competencias y experiencia, necesarios para ocupar el puesto).</Text>

        {/* II.1 Escolaridad */}
        <Text style={s.bold}>II.1    ESCOLARIDAD MÍNIMA:</Text>
        {data.perfil?.escolaridadMinima?.map((esc, i) => (
          <View key={`esc-${i}`} style={s.bulletItemContainer} wrap={false}>
            {/* Listas Numeradas en lugar de bullets */}
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{esc}</Text>
          </View>
        ))}

        {/* II.2 Competencias */}
        <Text style={{ ...s.bold, marginTop: 10 }}>II.2    COMPETENCIAS LABORALES REQUERIDAS:</Text>

        {/* II.2.1 Administrativas */}
        <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 5, marginLeft: 15, marginBottom: 5 }}>II.2.1  Administrativas:</Text>
        {data.perfil?.competenciasAdministrativas?.map((comp, i) => (
          <View key={`ca-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
          </View>
        ))}

        {/* II.2.2 Técnicas */}
        <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 5, marginLeft: 15, marginBottom: 5 }}>II.2.2  Técnicas:</Text>
        {data.perfil?.competenciasTecnicas?.map((comp, i) => (
          <View key={`ct-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
          </View>
        ))}

        {/* II.2.3 Sociales */}
        <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 5, marginLeft: 15, marginBottom: 5 }}>II.2.3  Sociales:</Text>
        {data.perfil?.competenciasSociales?.map((comp, i) => (
          <View key={`cs-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{comp}</Text>
          </View>
        ))}

        {/* II.2.4 Valores */}
        <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 5, marginLeft: 15, marginBottom: 5 }}>II.2.4  Valores:</Text>
        {data.perfil?.valores?.map((val, i) => (
          <View key={`val-${i}`} style={{...s.bulletItemContainer, paddingLeft: 30}} wrap={false}>
            <Text style={s.bulletSign}>{i + 1}.</Text>
            <Text style={s.listTextWrap} wrap={true}>{val}</Text>
          </View>
        ))}

        {/* II.3 Áreas y Años de Experiencia */}
        <View style={{ flexDirection: "row", marginTop: 15 }} wrap={false}>
          <View style={{ width: "50%" }}>
            <Text style={s.bold}>II.3    ÁREAS DE EXPERIENCIA:</Text>
            {data.perfil?.areasExperiencia?.map((area, i) => (
              <View key={`ae-${i}`} style={{...s.bulletItemContainer}} wrap={false}>
                <Text style={s.bulletSign}>{i + 1}.</Text>
                <Text style={s.listTextWrap} wrap={true}>{area}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: "50%" }}>
            <Text style={s.bold}>AÑOS DE EXPERIENCIA:</Text>
            <Text style={{ marginTop: 5, marginLeft: 15 }}>{data.perfil?.aniosExperiencia}</Text>
          </View>
        </View>

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
      <Page size="LETTER" style={s.page}>
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
