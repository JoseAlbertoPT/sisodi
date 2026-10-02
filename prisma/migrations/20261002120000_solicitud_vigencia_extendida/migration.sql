-- Solicitudes capturadas con permiso "Captura nueva solicitud" (vigencia de
-- más de 6 meses, hasta el 31 de diciembre). Ver lib/permiso-vigencia-solicitud.ts.
ALTER TABLE "solicitud" ADD COLUMN "vigencia_extendida" BOOLEAN NOT NULL DEFAULT false;
