-- AlterTable: gym's manual UPI payout details (member -> gym direct payments)
ALTER TABLE "gyms" ADD COLUMN "payoutUpiVpa" TEXT;
ALTER TABLE "gyms" ADD COLUMN "payoutAccountHolder" TEXT;
ALTER TABLE "gyms" ADD COLUMN "payoutBankAccountNumber" TEXT;
ALTER TABLE "gyms" ADD COLUMN "payoutBankIfsc" TEXT;
ALTER TABLE "gyms" ADD COLUMN "payoutPhone" TEXT;

-- AlterTable: member "I've paid" marker for manual UPI payments
ALTER TABLE "payments" ADD COLUMN "memberConfirmedAt" TIMESTAMP(3);
