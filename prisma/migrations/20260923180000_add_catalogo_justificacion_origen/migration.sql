-- Distingue en el catálogo lo importado del Excel (histórico consolidado) de lo
-- emitido en el sistema, para que la pestaña Consulta muestre solo lo importado.
-- Antes el origen solo se podía inferir por el historial de la solicitud, y se
-- perdía al borrar la solicitud (solicitud_id queda en NULL).
ALTER TABLE "public"."catalogo_justificacion"
  ADD COLUMN IF NOT EXISTS "origen" VARCHAR(20) NOT NULL DEFAULT 'sistema';

UPDATE "public"."catalogo_justificacion" cj
   SET "origen" = 'excel'
 WHERE EXISTS (
         SELECT 1 FROM "public"."historial_solicitud" hs
          WHERE hs.solicitud_id = cj.solicitud_id
            AND hs.comentario ILIKE 'Importado%'
       );
