ALTER TABLE "public"."usuario"
  ADD COLUMN IF NOT EXISTS "cargo" VARCHAR(200);
