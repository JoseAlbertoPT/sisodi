-- CreateTable
CREATE TABLE "documento_sellado" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "etapa" VARCHAR(20) NOT NULL,
    "archivo" VARCHAR(500) NOT NULL,
    "nombre_original" VARCHAR(255),
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_sellado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documento_sellado_solicitud_id_etapa_key" ON "documento_sellado"("solicitud_id", "etapa");

-- CreateIndex
CREATE INDEX "idx_documento_sellado_solicitud" ON "documento_sellado"("solicitud_id");

-- AddForeignKey
ALTER TABLE "documento_sellado" ADD CONSTRAINT "documento_sellado_solicitud_id_fkey"
    FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_sellado" ADD CONSTRAINT "documento_sellado_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "usuario"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
