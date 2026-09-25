-- Segunda firma (Vo.Bo. Emisor) en reutilización de Catálogo
ALTER TABLE "catalogo_solicitud" ADD COLUMN "firma_emisor" JSONB;
ALTER TABLE "catalogo_solicitud" ADD COLUMN "emisor_id" UUID;
ALTER TABLE "catalogo_solicitud" ADD COLUMN "firmado_en" TIMESTAMP(6);
