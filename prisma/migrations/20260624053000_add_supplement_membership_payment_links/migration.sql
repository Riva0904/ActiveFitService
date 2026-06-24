-- AlterTable: track which membership plan a MEMBERSHIP payment was for (server-priced
-- at checkout time, needed post-payment to actually activate/extend the subscription).
ALTER TABLE "payments" ADD COLUMN "membershipPlanId" TEXT;

-- AlterTable: link a fulfilled supplement order back to the payment that paid for it.
ALTER TABLE "supplement_orders" ADD COLUMN "paymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "supplement_orders_paymentId_key" ON "supplement_orders"("paymentId");

-- AddForeignKey
ALTER TABLE "supplement_orders" ADD CONSTRAINT "supplement_orders_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
