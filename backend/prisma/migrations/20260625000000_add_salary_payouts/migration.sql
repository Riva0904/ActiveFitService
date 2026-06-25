-- AlterTable: trainer/staff self-set UPI VPA for salary payouts
ALTER TABLE "users" ADD COLUMN "payoutUpiVpa" TEXT;

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "salary_payouts" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "salary_payouts_gymId_idx" ON "salary_payouts"("gymId");

CREATE INDEX "salary_payouts_userId_idx" ON "salary_payouts"("userId");

CREATE INDEX "salary_payouts_gymId_status_idx" ON "salary_payouts"("gymId", "status");

ALTER TABLE "salary_payouts" ADD CONSTRAINT "salary_payouts_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "salary_payouts" ADD CONSTRAINT "salary_payouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
