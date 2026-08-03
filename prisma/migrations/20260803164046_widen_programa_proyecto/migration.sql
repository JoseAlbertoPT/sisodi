-- AlterTable
ALTER TABLE "catalogo_justificacion" ALTER COLUMN "actualizado_en" DROP DEFAULT;

-- AlterTable
ALTER TABLE "solicitud" ALTER COLUMN "programa_proyecto" SET DATA TYPE TEXT;
