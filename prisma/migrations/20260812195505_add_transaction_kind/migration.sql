-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('EXPENSE', 'REVENUE');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "kind" "TransactionKind" NOT NULL DEFAULT 'EXPENSE';
