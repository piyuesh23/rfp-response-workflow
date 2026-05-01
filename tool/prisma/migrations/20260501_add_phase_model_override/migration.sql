-- Add modelOverride field to Phase table
-- null = use default model; non-null pins a specific Claude model for this phase run

ALTER TABLE "Phase" ADD COLUMN IF NOT EXISTS "modelOverride" TEXT;
