-- Additive only: existing rows get the default that matches current implicit IST behavior.
ALTER TABLE "gyms" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE "users" ADD COLUMN "timezone" TEXT;
