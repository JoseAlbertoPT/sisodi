-- WSFirmaOficio valida que cada firma de un mismo documento multifirma (mismo
-- uuid) mande EXACTAMENTE los mismos DatosFirma que la primera — folio, fecha,
-- contenido y destinatario. Si alguno cambia responde "codigoRespuesta 1029:
-- Los datos del documento a firmar no coinciden". Se guardan los datos de la
-- primera firma para reenviarlos idénticos en las siguientes.
ALTER TABLE "public"."firma_proceso"
  ADD COLUMN IF NOT EXISTS "datos_ws_firma" JSONB;
