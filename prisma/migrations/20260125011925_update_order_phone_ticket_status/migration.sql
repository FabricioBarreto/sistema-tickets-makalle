/*
  Warnings:

  - You are about to drop the column `validated` on the `Ticket` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Ticket_validated_idx";

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "buyerPhone" DROP NOT NULL,
ALTER COLUMN "buyerDNI" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "validated",
ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- CreateIndex
CREATE INDEX "Order_buyerPhone_idx" ON "Order"("buyerPhone");
