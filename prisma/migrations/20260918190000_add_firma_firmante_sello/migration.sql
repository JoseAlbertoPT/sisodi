-- Sello devuelto por WSFirmaOficio (firmaDatosEx) por cada firmante — antes se
-- consultaba en caliente vía efirmaClient.estado() a un portal REST que nunca
-- llegó a desplegarse; ahora se guarda directo al firmar.
ALTER TABLE "public"."firma_firmante"
  ADD COLUMN IF NOT EXISTS "sello_digital" TEXT,
  ADD COLUMN IF NOT EXISTS "estampado_tiempo" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "sello_estampado_tiempo" TEXT,
  ADD COLUMN IF NOT EXISTS "no_certificado_gem" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "rfc_gem" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "url_validacion" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "url_validacion_corta" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "uuid_firma" VARCHAR(100);
