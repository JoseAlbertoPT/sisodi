ALTER TABLE "public"."firma_proceso"
  ADD COLUMN IF NOT EXISTS "session_id" VARCHAR(64);
