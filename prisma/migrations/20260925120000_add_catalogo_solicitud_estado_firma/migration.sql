-- Doble firma en reutilización de Catálogo
ALTER TABLE "catalogo_solicitud" ADD COLUMN "estado" VARCHAR(30);
ALTER TABLE "catalogo_solicitud" ADD COLUMN "firma_uefa" JSONB;
CREATE INDEX "catalogo_solicitud_estado_idx" ON "catalogo_solicitud"("estado");
