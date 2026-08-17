-- Soporte para la nueva acción "Programa" del Catálogo (tipo = "programa" en
-- catalogo_solicitud): trazabilidad del Programa/Proyecto anterior y nuevo.
ALTER TABLE "catalogo_solicitud" ADD COLUMN "programa_anterior" VARCHAR(500);
ALTER TABLE "catalogo_solicitud" ADD COLUMN "nuevo_programa_proyecto" VARCHAR(500);
