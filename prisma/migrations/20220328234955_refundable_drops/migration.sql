/*
  Warnings:

  - Added the required column `refundable` to the `Drop` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Drop" ADD COLUMN     "refundable" BOOLEAN NOT NULL;
