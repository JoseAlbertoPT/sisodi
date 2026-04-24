ALTER TABLE "public"."firma_firmante"
  ADD COLUMN IF NOT EXISTS "cargo_firmante" VARCHAR(300);
