-- DropIndex
DROP INDEX "DependencyVersion_connectorId_repository_manager_packageFil_key";

-- AlterTable
ALTER TABLE "DependencyVersion" ADD COLUMN     "depType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DependencyVersion_connectorId_repository_manager_packageFil_key" ON "DependencyVersion"("connectorId", "repository", "manager", "packageFile", "depName", "depType");
