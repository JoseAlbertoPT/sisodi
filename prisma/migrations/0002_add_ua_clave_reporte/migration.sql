ALTER TABLE "organo_centralizado" ADD COLUMN IF NOT EXISTS "ua_clave_administrativa" VARCHAR(512);
ALTER TABLE "organo_centralizado" ADD COLUMN IF NOT EXISTS "clave_reporte_plazas" VARCHAR(100);
ALTER TABLE "organo_paraestatal" ADD COLUMN IF NOT EXISTS "ua_clave_administrativa" VARCHAR(512);
ALTER TABLE "organo_paraestatal" ADD COLUMN IF NOT EXISTS "clave_reporte_plazas" VARCHAR(100);
