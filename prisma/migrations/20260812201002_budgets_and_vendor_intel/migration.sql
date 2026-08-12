-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "negotiationBrief" TEXT,
ADD COLUMN     "negotiationBriefAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "approvalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 500;
