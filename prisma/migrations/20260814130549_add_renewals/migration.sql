-- CreateEnum
CREATE TYPE "RenewalType" AS ENUM ('INSURANCE', 'LICENSE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "RenewalType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "cadenceMonths" INTEGER,
    "status" "RenewalStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
