-- CreateEnum
CREATE TYPE "AttendanceCloseReason" AS ENUM ('NORMAL', 'AUTO_CHECKOUT');

-- AlterTable
ALTER TABLE "members" ADD COLUMN "attendanceStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "members" ADD COLUMN "bestAttendanceStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "members" ADD COLUMN "lastAttendanceDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN "closeReason" "AttendanceCloseReason" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "occupancy_snapshots" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "occupancyCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occupancy_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "occupancy_snapshots_gymId_idx" ON "occupancy_snapshots"("gymId");

-- CreateIndex
CREATE INDEX "occupancy_snapshots_gymId_createdAt_idx" ON "occupancy_snapshots"("gymId", "createdAt");

-- AddForeignKey
ALTER TABLE "occupancy_snapshots" ADD CONSTRAINT "occupancy_snapshots_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
