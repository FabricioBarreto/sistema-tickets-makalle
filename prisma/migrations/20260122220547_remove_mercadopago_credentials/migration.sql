/*
  Warnings:

  - You are about to drop the column `notes` on the `Validation` table. All the data in the column will be lost.
  - You are about to drop the column `success` on the `Validation` table. All the data in the column will be lost.
  - You are about to drop the `SystemConfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "Validation_success_idx";

-- DropIndex
DROP INDEX "Validation_timestamp_idx";

-- AlterTable
ALTER TABLE "Validation" DROP COLUMN "notes",
DROP COLUMN "success";

-- DropTable
DROP TABLE "SystemConfig";

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL,
    "ticketPrice" DECIMAL(10,2) NOT NULL,
    "totalAvailable" INTEGER NOT NULL,
    "maxPerPurchase" INTEGER NOT NULL DEFAULT 10,
    "salesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventLocation" TEXT,
    "emailFrom" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);
