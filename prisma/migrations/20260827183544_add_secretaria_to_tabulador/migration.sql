-- AlterTable
ALTER TABLE "tabulador" ADD COLUMN "secretaria" VARCHAR(200);

-- DropIndex
DROP INDEX "tabulador_nivel_categoria_key";

-- CreateIndex
CREATE UNIQUE INDEX "tabulador_nivel_categoria_secretaria_key" ON "tabulador"("nivel", "categoria", "secretaria");
