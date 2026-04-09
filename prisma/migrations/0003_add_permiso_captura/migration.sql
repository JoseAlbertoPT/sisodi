CREATE TABLE IF NOT EXISTS "permiso_captura" (
  "id"          SERIAL        NOT NULL,
  "usuario_id"  UUID          NOT NULL,
  "regimen"     VARCHAR(20)   NOT NULL,
  "periodo"     VARCHAR(50)   NOT NULL,
  "active"      BOOLEAN       NOT NULL DEFAULT true,
  "used"        BOOLEAN       NOT NULL DEFAULT false,
  "granted_at"  TIMESTAMP(6)  NOT NULL DEFAULT now(),
  "granted_by"  VARCHAR(150)  NOT NULL,
  "consumed_at" TIMESTAMP(6),
  CONSTRAINT "permiso_captura_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permiso_captura_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE
);
