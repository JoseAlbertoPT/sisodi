-- CreateTable
CREATE TABLE "tabulador" (
    "id" SERIAL NOT NULL,
    "nivel" VARCHAR(20) NOT NULL,
    "categoria" VARCHAR(50) NOT NULL,
    "importe_bruto_min" DECIMAL(14,2) NOT NULL,
    "importe_bruto_max" DECIMAL(14,2) NOT NULL,
    "creado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tabulador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tabulador_nivel_categoria_key" ON "tabulador"("nivel", "categoria");
