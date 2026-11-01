-- AlterEnum
ALTER TYPE "ConnectorType" ADD VALUE 'DEPENDENCIES';

-- CreateTable
CREATE TABLE "DependencyVersion" (
    "id" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "manager" TEXT NOT NULL,
    "packageFile" TEXT NOT NULL,
    "depName" TEXT NOT NULL,
    "currentValue" TEXT,
    "currentVersion" TEXT,
    "recommendedVersion" TEXT,
    "updateType" TEXT,
    "isUpToDate" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,

    CONSTRAINT "DependencyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DependencyVersion_connectorId_repository_manager_packageFil_key" ON "DependencyVersion"("connectorId", "repository", "manager", "packageFile", "depName");

-- AddForeignKey
ALTER TABLE "DependencyVersion" ADD CONSTRAINT "DependencyVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyVersion" ADD CONSTRAINT "DependencyVersion_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
