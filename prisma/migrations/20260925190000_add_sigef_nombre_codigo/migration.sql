-- Datos de SIGeF de la última sincronización de dependencias (lib/sigef-sync.ts):
-- permiten reconocer una Secretaría aunque SIGeF le cambie el id o el nombre.
ALTER TABLE "organo_centralizado" ADD COLUMN "sigef_nombre" VARCHAR(512);
ALTER TABLE "organo_centralizado" ADD COLUMN "sigef_codigo" VARCHAR(10);
