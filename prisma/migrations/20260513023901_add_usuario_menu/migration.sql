-- DropForeignKey
ALTER TABLE "firma_firmante" DROP CONSTRAINT "firma_firmante_usuario_fkey";

-- DropForeignKey
ALTER TABLE "firma_proceso" DROP CONSTRAINT "firma_proceso_usuario_fkey";

-- AlterTable
ALTER TABLE "solicitud" ALTER COLUMN "escolaridad" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "usuario_menu" (
    "id" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "menu_id" INTEGER NOT NULL,

    CONSTRAINT "usuario_menu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_menu_usuario_id_menu_id_key" ON "usuario_menu"("usuario_id", "menu_id");

-- RenameForeignKey
ALTER TABLE "firma_firmante" RENAME CONSTRAINT "firma_firmante_proceso_fkey" TO "firma_firmante_firma_proceso_id_fkey";

-- RenameForeignKey
ALTER TABLE "firma_proceso" RENAME CONSTRAINT "firma_proceso_solicitud_fkey" TO "firma_proceso_solicitud_id_fkey";

-- AddForeignKey
ALTER TABLE "firma_proceso" ADD CONSTRAINT "firma_proceso_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "firma_firmante" ADD CONSTRAINT "firma_firmante_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_menu" ADD CONSTRAINT "usuario_menu_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_menu" ADD CONSTRAINT "usuario_menu_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
