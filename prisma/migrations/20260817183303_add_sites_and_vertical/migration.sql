-- CreateEnum
CREATE TYPE "Vertical" AS ENUM ('HOSPITALITY', 'HEALTHCARE', 'TECH');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "vertical" "Vertical" NOT NULL DEFAULT 'HOSPITALITY';

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_workspaceId_name_key" ON "Site"("workspaceId", "name");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing workspace gets exactly one default site, named after the
-- workspace itself, so existing single-location workspaces (e.g. "Ruth's") keep working
-- unchanged — the app already has "a site" the moment this migration finishes.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "Site" ("id", "name", "location", "isDefault", "workspaceId")
SELECT gen_random_uuid()::text, w."name", w."location", true, w."id"
FROM "Workspace" w;
