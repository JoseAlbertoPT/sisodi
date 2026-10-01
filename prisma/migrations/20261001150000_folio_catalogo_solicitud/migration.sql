-- Folio actual de cada reutilización/cancelación del Catálogo:
-- NN/MM/AAAA-CH | NN/MM/AAAA-CA, consecutivo global mensual (lib/folio-catalogo.ts).
-- Las filas existentes quedan en NULL y conservan el formato anterior ("folio-N").
ALTER TABLE "catalogo_solicitud"
    ADD COLUMN "folio" VARCHAR(50),
    ADD COLUMN "folio_consecutivo" INTEGER,
    ADD COLUMN "folio_mes" INTEGER,
    ADD COLUMN "folio_anio" INTEGER,
    ADD COLUMN "folio_tipo" VARCHAR(2);

CREATE UNIQUE INDEX "catalogo_solicitud_folio_key" ON "catalogo_solicitud"("folio");

CREATE UNIQUE INDEX "catalogo_solicitud_folio_anio_folio_mes_folio_consecutivo_key"
    ON "catalogo_solicitud"("folio_anio", "folio_mes", "folio_consecutivo");
