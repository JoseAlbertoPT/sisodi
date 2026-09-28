-- Se quita la doble firma (Vo.Bo. del Emisor) de la reutilización de Catálogo:
-- la UEFA firma y el Dictamen se descarga al momento, como antes.
DROP INDEX IF EXISTS "catalogo_solicitud_estado_idx";
ALTER TABLE "catalogo_solicitud" DROP COLUMN IF EXISTS "estado";
ALTER TABLE "catalogo_solicitud" DROP COLUMN IF EXISTS "firma_uefa";
ALTER TABLE "catalogo_solicitud" DROP COLUMN IF EXISTS "firma_emisor";
ALTER TABLE "catalogo_solicitud" DROP COLUMN IF EXISTS "emisor_id";
ALTER TABLE "catalogo_solicitud" DROP COLUMN IF EXISTS "firmado_en";
