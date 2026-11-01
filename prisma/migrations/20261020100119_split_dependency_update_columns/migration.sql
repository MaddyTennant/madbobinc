/*
  Warnings:

  - You are about to drop the column `recommendedVersion` on the `DependencyVersion` table. All the data in the column will be lost.
  - You are about to drop the column `updateType` on the `DependencyVersion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DependencyVersion" DROP COLUMN "recommendedVersion",
DROP COLUMN "updateType",
ADD COLUMN     "nextMajorVersion" TEXT,
ADD COLUMN     "nextMinorUpdateType" TEXT,
ADD COLUMN     "nextMinorVersion" TEXT;
