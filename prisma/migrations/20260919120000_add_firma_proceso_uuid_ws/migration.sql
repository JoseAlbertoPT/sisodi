-- El uuid del "documento multifirma" que WSFirmaOficio genera y regresa en la
-- primera firma real (firmaDatosEx) es distinto del uuid interno que usamos
-- como key de S3 (firma_proceso.uuid) — hay que guardarlo aparte y reenviarlo
-- en las firmas siguientes del mismo proceso, o el servicio responde
-- "codigoRespuesta 1027: El documento no existe o no pertenece a multifirma".
ALTER TABLE "public"."firma_proceso"
  ADD COLUMN IF NOT EXISTS "uuid_ws_firma" VARCHAR(100);
