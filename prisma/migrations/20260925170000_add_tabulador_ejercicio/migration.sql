-- Tabulador por año. Los registros existentes quedan como ejercicio 2026.
ALTER TABLE "tabulador" ADD COLUMN "ejercicio" INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE "tabulador" ALTER COLUMN "ejercicio" DROP DEFAULT;
CREATE INDEX "tabulador_ejercicio_idx" ON "tabulador"("ejercicio");
