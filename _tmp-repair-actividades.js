require("dotenv").config();
const XLSX = require("xlsx");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("./lib/generated/prisma");

const COMMIT = process.argv.includes("--commit");
const EXCEL_PATH = "C:/Users/SAFDGSAC035/Downloads/BD-CATALOGO-SISODIJ-DGSAC_CONSOLIDADO.xlsx";
const SHEET_NAME = "BASE CONSOLIDADA";

const COL_Q = "ACTIVIDADES A REALIZAR POR EL PRESTADOR DE SERVICIOS";
const COL_R = "RESPONSABILIDADES A CUMPLIR POR EL PRESTADOR DE SERVICIOS";
const COL_FOLIO_DICTAMEN = "FOLIO DE DICTAMEN/OPINIÓN";
const COL_FOLIO_JUST = "FOLIO DE JUSTIFICACIÓN/DESCRIPCIÓN";

function parseListField(raw) {
  const s = (raw ?? "").trim();
  if (!s) return [];
  return s.split(/\r\n|\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

function sameArray(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[SHEET_NAME];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const headers = raw[0];
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => c === "")) continue;
    const obj = {};
    headers.forEach((h, j) => (obj[h] = r[j]));
    rows.push(obj);
  }

  // folio_dictamen NO es único globalmente (cada secretaría llevaba su propio
  // conteo en el proceso en papel, ver comentario en import-historico-consolidado.ts).
  // folio_justificacion sí trae prefijo de secretaría y es mucho más confiable,
  // pero tampoco es 100% único. Se indexan ambos como listas (arrays) para
  // poder detectar ambigüedad y NO adivinar en esos casos.
  const byFolioDictamen = new Map();
  const byFolioJust = new Map();
  for (const r of rows) {
    const fd = (r[COL_FOLIO_DICTAMEN] || "").trim();
    const fj = (r[COL_FOLIO_JUST] || "").trim();
    if (fd) { if (!byFolioDictamen.has(fd)) byFolioDictamen.set(fd, []); byFolioDictamen.get(fd).push(r); }
    if (fj) { if (!byFolioJust.has(fj)) byFolioJust.set(fj, []); byFolioJust.get(fj).push(r); }
  }
  const dupDictamen = [...byFolioDictamen.entries()].filter(([, v]) => v.length > 1).length;
  const dupJust = [...byFolioJust.entries()].filter(([, v]) => v.length > 1).length;
  console.log(`folio_dictamen: ${byFolioDictamen.size} valores distintos, ${dupDictamen} duplicados (se usan solo si son únicos).`);
  console.log(`folio_justificacion: ${byFolioJust.size} valores distintos, ${dupJust} duplicados (se usan solo si son únicos).`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const cjAll = await prisma.catalogo_justificacion.findMany({
    select: { id: true, folio_dictamen: true, folio_justificacion: true, actividades: true, responsabilidades: true, solicitud_id: true },
  });
  const solAll = await prisma.solicitud.findMany({
    select: { id: true, folio_dictamen: true, folio_justificacion: true, actividades: true, responsabilidades: true },
  });

  // Prioridad: folio_justificacion único > folio_dictamen único. Si ambos son
  // ambiguos (o no hay match), se marca "ambiguo/sin match" y NO se adivina.
  function findExcelRow(folioDictamen, folioJust) {
    const fj = (folioJust || "").trim();
    if (fj) {
      const group = byFolioJust.get(fj);
      if (group && group.length === 1) return { row: group[0], via: "folio_justificacion" };
      if (group && group.length > 1) return { row: null, via: "ambiguo:folio_justificacion" };
    }
    const fd = (folioDictamen || "").trim();
    if (fd) {
      const group = byFolioDictamen.get(fd);
      if (group && group.length === 1) return { row: group[0], via: "folio_dictamen" };
      if (group && group.length > 1) return { row: null, via: "ambiguo:folio_dictamen" };
    }
    return { row: null, via: "sin_match" };
  }

  let matched = 0, noMatch = 0, ambiguo = 0, sinCambio = 0, cambios = 0;
  const cjUpdates = [];
  const cjAmbiguos = [];
  for (const cj of cjAll) {
    const { row: excelRow, via } = findExcelRow(cj.folio_dictamen, cj.folio_justificacion);
    if (!excelRow) {
      if (via.startsWith("ambiguo")) { ambiguo++; cjAmbiguos.push({ id: cj.id, folio_dictamen: cj.folio_dictamen, folio_justificacion: cj.folio_justificacion, via }); }
      else noMatch++;
      continue;
    }
    matched++;
    const actividades = parseListField(excelRow[COL_Q]);
    const responsabilidades = parseListField(excelRow[COL_R]);
    if (sameArray(actividades, cj.actividades) && sameArray(responsabilidades, cj.responsabilidades)) {
      sinCambio++;
      continue;
    }
    cambios++;
    cjUpdates.push({ id: cj.id, folio_dictamen: cj.folio_dictamen, via, actividades, responsabilidades, before: cj });
  }

  let matchedSol = 0, noMatchSol = 0, ambiguoSol = 0, sinCambioSol = 0, cambiosSol = 0;
  const solUpdates = [];
  const solAmbiguos = [];
  for (const sol of solAll) {
    const { row: excelRow, via } = findExcelRow(sol.folio_dictamen, sol.folio_justificacion);
    if (!excelRow) {
      if (via.startsWith("ambiguo")) { ambiguoSol++; solAmbiguos.push({ id: sol.id, folio_dictamen: sol.folio_dictamen, folio_justificacion: sol.folio_justificacion, via }); }
      else noMatchSol++;
      continue;
    }
    matchedSol++;
    const actividades = parseListField(excelRow[COL_Q]);
    const responsabilidades = parseListField(excelRow[COL_R]);
    if (sameArray(actividades, sol.actividades) && sameArray(responsabilidades, sol.responsabilidades)) {
      sinCambioSol++;
      continue;
    }
    cambiosSol++;
    solUpdates.push({ id: sol.id, folio_dictamen: sol.folio_dictamen, via, actividades, responsabilidades, before: sol });
  }

  console.log("\n=== catalogo_justificacion ===");
  console.log("total:", cjAll.length, "| match único:", matched, "| ambiguo (NO se toca):", ambiguo, "| sin match:", noMatch, "| sin cambio:", sinCambio, "| A CORREGIR:", cambios);
  if (cjAmbiguos.length > 0) {
    console.log("  Ambiguos catalogo_justificacion (requieren revisión manual):");
    for (const a of cjAmbiguos) console.log(`    id=${a.id} folio_dictamen=${a.folio_dictamen} folio_justificacion=${a.folio_justificacion} (${a.via})`);
  }
  console.log("\n=== solicitud ===");
  console.log("total:", solAll.length, "| match único:", matchedSol, "| ambiguo (NO se toca):", ambiguoSol, "| sin match:", noMatchSol, "| sin cambio:", sinCambioSol, "| A CORREGIR:", cambiosSol);
  if (solAmbiguos.length > 0) {
    console.log("  Ambiguos solicitud (requieren revisión manual):");
    for (const a of solAmbiguos) console.log(`    id=${a.id} folio_dictamen=${a.folio_dictamen} folio_justificacion=${a.folio_justificacion} (${a.via})`);
  }

  console.log("\n--- Muestra de 3 catalogo_justificacion a corregir ---");
  for (const u of cjUpdates.slice(0, 3)) {
    console.log(`\nid=${u.id} folio=${u.folio_dictamen}`);
    console.log("  ANTES actividades:", JSON.stringify(u.before.actividades));
    console.log("  DESPUES actividades:", JSON.stringify(u.actividades));
    console.log("  ANTES responsabilidades:", JSON.stringify(u.before.responsabilidades));
    console.log("  DESPUES responsabilidades:", JSON.stringify(u.responsabilidades));
  }

  if (!COMMIT) {
    console.log("\nModo dry-run (sin --commit). No se escribió nada en la base de datos.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nEscribiendo ${cjUpdates.length} catalogo_justificacion y ${solUpdates.length} solicitud...`);
  for (const u of cjUpdates) {
    await prisma.catalogo_justificacion.update({
      where: { id: u.id },
      data: { actividades: u.actividades, responsabilidades: u.responsabilidades },
    });
  }
  for (const u of solUpdates) {
    await prisma.solicitud.update({
      where: { id: u.id },
      data: { actividades: u.actividades, responsabilidades: u.responsabilidades },
    });
  }
  console.log("Listo.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
