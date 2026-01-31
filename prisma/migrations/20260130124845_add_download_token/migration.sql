/*
  Warnings:

  - A unique constraint covering the columns `[downloadToken]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "downloadToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_downloadToken_key" ON "Order"("downloadToken");

-- CreateIndex
CREATE INDEX "Order_downloadToken_idx" ON "Order"("downloadToken");
