-- AlterTable: bloqueo escalonado por intentos fallidos de login
ALTER TABLE "usuario" ADD COLUMN "intentos_fallidos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuario" ADD COLUMN "bloqueado_hasta" TIMESTAMP(6);
ALTER TABLE "usuario" ADD COLUMN "nivel_bloqueo" INTEGER NOT NULL DEFAULT 0;
