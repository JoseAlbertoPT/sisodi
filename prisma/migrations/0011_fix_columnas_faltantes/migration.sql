-- Reconciliación: el schema.prisma declara columnas que la base de datos
-- no tenía. Las agregamos con IF NOT EXISTS para que sea idempotente.

ALTER TABLE "solicitud"
  ADD COLUMN IF NOT EXISTS "riesgo_caidas"              VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "riesgo_mutilaciones"        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "riesgo_golpes"              VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "riesgo_otros"               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "condicion_cambio_domicilio" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "condicion_horario"          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "condicion_viajar"           BOOLEAN DEFAULT FALSE;
