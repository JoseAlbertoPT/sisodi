-- Sesiones del lado del servidor (ver lib/session.ts): el login emite una
-- cookie HttpOnly con un token aleatorio; aquí solo se guarda su hash SHA-256.
CREATE TABLE "sesion" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "creada_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sesion_token_hash_key" ON "sesion"("token_hash");
CREATE INDEX "idx_sesion_usuario" ON "sesion"("usuario_id");

ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Recuperación de contraseña: límite de intentos por código y token de un
-- solo uso que prueba que el código ya se validó (ver /api/auth).
ALTER TABLE "codigo_recuperacion" ADD COLUMN "intentos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "codigo_recuperacion" ADD COLUMN "reset_token_hash" VARCHAR(64);
