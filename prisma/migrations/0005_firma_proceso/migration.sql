-- AlterTable: agregar modalidad_firma a solicitud
ALTER TABLE "public"."solicitud"
  ADD COLUMN IF NOT EXISTS "modalidad_firma" VARCHAR(20);

-- CreateTable: firma_proceso
CREATE TABLE IF NOT EXISTS "public"."firma_proceso" (
  "id"               SERIAL       PRIMARY KEY,
  "solicitud_id"     INTEGER      NOT NULL UNIQUE,
  "tipo"             VARCHAR(20)  NOT NULL,
  "proceso_id"       VARCHAR(100),
  "uuid"             VARCHAR(100) UNIQUE,
  "acceso_token"     VARCHAR(64),
  "total_firmantes"  INTEGER,
  "firmados"         INTEGER      NOT NULL DEFAULT 0,
  "archivo_firmado"  VARCHAR(500),
  "estado"           VARCHAR(20)  NOT NULL DEFAULT 'iniciado',
  "creado_por_id"    UUID         NOT NULL,
  "fecha_creacion"   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_completado" TIMESTAMP(6),
  CONSTRAINT "firma_proceso_solicitud_fkey"
    FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitud"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "firma_proceso_usuario_fkey"
    FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuario"("id")
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_firma_proceso_solicitud"
  ON "public"."firma_proceso" ("solicitud_id");
