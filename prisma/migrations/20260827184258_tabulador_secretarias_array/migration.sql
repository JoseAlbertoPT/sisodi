-- AlterTable: replace single nullable "secretaria" with a "secretarias" array
-- (empty array = applies to every Secretaría/Dependencia).
ALTER TABLE "tabulador" ADD COLUMN "secretarias" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "tabulador" SET "secretarias" = ARRAY["secretaria"] WHERE "secretaria" IS NOT NULL AND "secretaria" <> '';

DROP INDEX IF EXISTS "tabulador_nivel_categoria_secretaria_key";

ALTER TABLE "tabulador" DROP COLUMN "secretaria";
