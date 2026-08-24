ALTER TABLE "public"."firma_firmante"
  ADD COLUMN IF NOT EXISTS "verificado" BOOLEAN NOT NULL DEFAULT false;
