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

export interface JustificacionData {
  tipoAdministracion: 'centralizada' | 'paraestatal';
  formato: 'fisico' | 'en_linea';
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
  firmaElaboroNombre?: string;
  firmaRevisoNombre?: string;
  firmaDictRevisoNombre?: string;
  firmaDictVerificoNombre?: string;
  firmaDictEmitioNombre?: string;
}

const LOGO_FINANZAS = path.join(process.cwd(), "public/logo-20finanzas.png");
const MARCA_MORELOS = path.join(process.cwd(), "public/LOGO_MORELOS_V1.png");

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
    opacity: 0.06,
    zIndex: -1,
  },
  watermarkImage: {
    width: 600,
    height: "auto",
    transform: 'scale(2.5)',
    objectFit: 'contain',
  },
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

  fechaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 },
  centeredTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", marginBottom: 6 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 3, marginTop: 6 },

  row: { flexDirection: "row", marginBottom: 4, alignItems: "flex-end" },
  bold: { fontFamily: "Helvetica-Bold" },
  numLabel: { width: 15, fontFamily: "Helvetica-Bold", fontSize: 9 },
  marginLabel: { fontFamily: "Helvetica-Bold", marginRight: 5, fontSize: 9 },
  valueText: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontSize: 9,
    fontFamily: "Helvetica",
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
  checkText: { fontSize: 8, fontFamily: "Helvetica-Bold" },

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

  listItemContainer: { flexDirection: "row", marginBottom: 3, paddingLeft: 10, marginTop: 2 },
  listNum: { width: 15, fontFamily: "Helvetica-Bold" },
  listTextWrap: { flex: 1, textAlign: "justify", lineHeight: 1.3 },
  bulletItemContainer: { flexDirection: "row", marginBottom: 2, paddingLeft: 20, marginTop: 1 },
  bulletSign: { width: 15, fontFamily: "Helvetica" },

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
  firmaNombre: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 5, minHeight: 12 },
  firmaDesc: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    textAlign: "center",
    lineHeight: 1.3,
  },

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

export function PlantillaJustificacionServicios({ data }: { data: JustificacionData }) {
  const isHonorarios = data.regimenContratacion?.toLowerCase().includes("honorarios") && !data.regimenContratacion?.toLowerCase().includes("asimilado");
  const isAsimilados = data.regimenContratacion?.toLowerCase().includes("asimilado");

  const inD = parseDateParts(data.vigenciaInicio);
  const finD = parseDateParts(data.vigenciaTermino);

  return (
    <Document>
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



        <View style={s.fechaRow}>
          <Text style={s.bold}>Fecha de elaboración de la Justificación: </Text>
          <Text style={{ borderBottomWidth: 1, minWidth: 150, textAlign: "center" }}>
            {new Date().toLocaleDateString("es-MX")}
          </Text>
        </View>

        <Text style={s.centeredTitle}>JUSTIFICACIÓN DE PRESTACIÓN DE SERVICIOS</Text>

        <Text style={s.sectionTitle}>I.    DATOS GENERALES:</Text>

        <View style={s.row}>
          <Text style={s.numLabel}>1.</Text>
          <Text style={s.marginLabel}>Secretaría/Subsecretaría/Dependencia/Organismo Auxiliar:</Text>
          <Text style={s.valueText}>{data.secretaria}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>2.</Text>
          <Text style={s.marginLabel}>Unidad Administrativa de Adscripción:</Text>
          <Text style={{ fontSize: 7, marginRight: 5 }}>(área donde se prestará el servicio)</Text>
          <Text style={s.valueText}>{data.unidadAdministrativa}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>3.</Text>
          <Text style={s.marginLabel}>Unidad Responsable del Gasto:</Text>
          <Text style={s.valueText}>{data.unidadResponsable}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>4.</Text>
          <Text style={s.marginLabel}>Programa o Proyecto:</Text>
          <Text style={s.valueText}>{data.programaProyecto}</Text>
        </View>

        <View style={{ ...s.row, alignItems: "center" }}>
          <Text style={s.numLabel}>5.</Text>
          <Text style={s.marginLabel}>Régimen de Contratación:</Text>
          <View style={s.checkboxRect}>{isHonorarios && <Text style={s.checkText}>X</Text>}</View>
          <Text style={{ marginRight: 20 }}>Honorarios</Text>
          <View style={s.checkboxRect}>{isAsimilados && <Text style={s.checkText}>X</Text>}</View>
          <Text>Honorarios Asimilados a Salarios</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>6.</Text>
          <Text style={s.marginLabel}>Tipo de Actividades:</Text>
          <Text style={s.valueText}>{data.tipoActividades || ""}</Text>
        </View>

        <View style={s.row}>
          <Text style={s.numLabel}>7.</Text>
          <Text style={s.marginLabel}>Número de Prestadores de Servicios:</Text>
          <Text style={s.valueText}>{data.numeroPrestadores}</Text>
        </View>

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

        <View style={{ ...s.row, marginTop: 5 }}>
          <Text style={s.numLabel}>9.</Text>
          <Text style={s.marginLabel}>Importe Bruto:</Text>
          <Text style={s.valueText}>{data.importeBruto}</Text>
        </View>

        <View style={{ ...s.row, marginTop: 5 }}>
          <Text style={s.numLabel}>10.</Text>
          <Text style={s.marginLabel}>Tipo de Pago:</Text>
          <Text style={s.valueText}>{data.tipoPago}</Text>
        </View>

        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 15 }}>I.1.    OBJETO DE LA CONTRATACIÓN:</Text>
          <Text style={{ textAlign: "justify", lineHeight: 1.3, marginBottom: 10, marginTop: 5 }}>{data.objetoContratacion}</Text>
        </View>

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

        <View wrap={false}>
          <Text style={{ ...s.sectionTitle, marginTop: 15 }}>II.  PERFIL A CUBRIR POR EL PRESTADOR DE SERVICIOS:</Text>
          <Text style={{ marginBottom: 8, fontSize: 8 }}>(Se refiere a la escolaridad, competencias y experiencia)</Text>

          <Text style={{ ...s.bold, marginBottom: 10 }}>II. 1.  ESCOLARIDAD MÍNIMA:</Text>
          {data.perfil?.escolaridadMinima?.slice(0, 1).map((esc, i) => (
            <View key={`esc-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{i + 1}.</Text>
              <Text style={s.listTextWrap}>{esc}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.escolaridadMinima?.slice(1).map((esc, i) => (
          <View key={`esc-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 2}.</Text>
            <Text style={s.listTextWrap}>{esc}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginTop: 10, marginBottom: 12 }}>II. 2.  COMPETENCIAS LABORALES REQUERIDAS:</Text>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 3 }}>II. 2.1.  Administrativas:</Text>
          {data.perfil?.competenciasAdministrativas?.slice(0, 1).map((comp, i) => (
            <View key={`ca-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{i + 1}.</Text>
              <Text style={s.listTextWrap}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasAdministrativas?.slice(1).map((comp, i) => (
          <View key={`ca-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 2}.</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 8, marginBottom: 4 }}>II. 2.2.  Técnicas:</Text>
          {data.perfil?.competenciasTecnicas?.slice(0, 1).map((comp, i) => (
            <View key={`ct-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{i + 1}.</Text>
              <Text style={s.listTextWrap}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasTecnicas?.slice(1).map((comp, i) => (
          <View key={`ct-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 2}.</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 8, marginBottom: 4 }}>II. 2.3.  Sociales:</Text>
          {data.perfil?.competenciasSociales?.slice(0, 1).map((comp, i) => (
            <View key={`cs-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{i + 1}.</Text>
              <Text style={s.listTextWrap}>{comp}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.competenciasSociales?.slice(1).map((comp, i) => (
          <View key={`cs-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 2}.</Text>
            <Text style={s.listTextWrap}>{comp}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginLeft: 15, marginTop: 3 }}>II. 2.4.  Valores:</Text>
          {data.perfil?.valores?.slice(0, 1).map((val, i) => (
            <View key={`val-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{i + 1}.</Text>
              <Text style={s.listTextWrap}>{val}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.valores?.slice(1).map((val, i) => (
          <View key={`val-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 2}.</Text>
            <Text style={s.listTextWrap}>{val}</Text>
          </View>
        ))}

        <View wrap={false}>
          <Text style={{ ...s.bold, marginTop: 5 }}>II.3.  ÁREAS DE EXPERIENCIA:</Text>
          {data.perfil?.areasExperiencia?.slice(0, 1).map((area, i) => (
            <View key={`ae-${i}`} style={s.bulletItemContainer}>
              <Text style={s.bulletSign}>{i + 1}.</Text>
              <Text style={s.listTextWrap}>{area}</Text>
            </View>
          ))}
        </View>
        {data.perfil?.areasExperiencia?.slice(1).map((area, i) => (
          <View key={`ae-${i + 1}`} style={s.bulletItemContainer} wrap={false}>
            <Text style={s.bulletSign}>{i + 2}.</Text>
            <Text style={s.listTextWrap}>{area}</Text>
          </View>
        ))}


        <View style={{ flex: 1 }} />

        {data.formato === 'en_linea' && (
          <View style={{ marginBottom: 15, alignItems: 'center' }} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, textAlign: 'center', marginBottom: 4 }}>ATENTAMENTE</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center', marginBottom: 2 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
            <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
              a través de un certificado reconocido legalmente y tiene, en relación a la información firmada un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
            </Text>
          </View>
        )}

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

      </Page>

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
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>Nota:</Text>
            <Text style={{ fontSize: 8, textAlign: "justify", lineHeight: 1.4 }}>
              Esta Dirección General únicamente dictamina sobre la funcionalidad de las actividades conforme con la metodología establecida y queda fuera de sus atribuciones la distribución y ejecución de los recursos para el pago de las contrataciones, en las cuales se deberá observar lo dispuesto por el Artículo Quinto del Presupuesto de Egresos del Gobierno del Estado de Morelos para el ejercicio fiscal 2026 y demás normatividad aplicable.
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {data.formato === 'en_linea' && (
          <View style={{ marginBottom: 15, alignItems: 'center' }} wrap={false}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, textAlign: 'center', marginBottom: 4 }}>ATENTAMENTE</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center', marginBottom: 2 }}>DOCUMENTO FIRMADO ELECTRÓNICAMENTE</Text>
            <Text style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.4, maxWidth: '85%' }}>
              a través de un certificado reconocido legalmente y tiene, en relación a la información firmada un valor jurídico y equivalente al de la firma autógrafa, en términos de la Ley de Transformación Digital del Estado de Morelos.
            </Text>
          </View>
        )}

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

      </Page>
    </Document>
  );
}