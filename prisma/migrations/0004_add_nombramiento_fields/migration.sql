ALTER TABLE "public"."solicitud"
  ADD COLUMN IF NOT EXISTS "puesto_jefe_inmediato" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "marco_normativo"       TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "condiciones_riesgos"   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "resguardo_activos"      VARCHAR(10);
