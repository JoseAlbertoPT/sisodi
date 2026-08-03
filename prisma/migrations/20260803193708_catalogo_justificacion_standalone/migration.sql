-- DropForeignKey
ALTER TABLE "catalogo_justificacion" DROP CONSTRAINT "catalogo_justificacion_solicitud_id_fkey";

-- AlterTable
ALTER TABLE "catalogo_justificacion" ADD COLUMN     "folio_dictamen" VARCHAR(50),
ADD COLUMN     "folio_recepcion" VARCHAR(50),
ADD COLUMN     "secretaria" VARCHAR(200),
ADD COLUMN     "secretaria_txt_snapshot" VARCHAR(512),
ADD COLUMN     "tipo_solicitud" VARCHAR(100),
ALTER COLUMN "solicitud_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "catalogo_justificacion" ADD CONSTRAINT "catalogo_justificacion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
