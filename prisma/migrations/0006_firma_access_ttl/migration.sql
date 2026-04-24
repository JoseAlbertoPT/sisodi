ALTER TABLE "public"."firma_proceso"
  ADD COLUMN IF NOT EXISTS "accedido_en" TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS "expira_en"   TIMESTAMP(6);
