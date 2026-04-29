CREATE TABLE IF NOT EXISTS "public"."firma_firmante" (
  "id"                SERIAL        PRIMARY KEY,
  "firma_proceso_id"  INTEGER       NOT NULL,
  "orden"             INTEGER       NOT NULL,
  "rol"               VARCHAR(30)   NOT NULL,
  "cargo"             VARCHAR(300)  NOT NULL,
  "tipo"              VARCHAR(20)   NOT NULL,
  "bandeja"           VARCHAR(20),
  "usuario_id"        UUID,
  "nombre"            VARCHAR(200),
  "rfc"               VARCHAR(20),
  "correo"            VARCHAR(200),
  "firmado"           BOOLEAN       NOT NULL DEFAULT FALSE,
  "fecha_firma"       TIMESTAMP(6),
  "acceso_token"      VARCHAR(64)   UNIQUE,
  "accedido_en"       TIMESTAMP(6),
  "expira_en"         TIMESTAMP(6),
  "session_id"        VARCHAR(64),
  CONSTRAINT "firma_firmante_proceso_fkey"
    FOREIGN KEY ("firma_proceso_id") REFERENCES "public"."firma_proceso"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "firma_firmante_usuario_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id")
    ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_firma_firmante_proceso"
  ON "public"."firma_firmante" ("firma_proceso_id");
