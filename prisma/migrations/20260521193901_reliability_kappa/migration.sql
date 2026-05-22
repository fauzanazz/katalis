/*
  Warnings:

  - You are about to drop the column `intensityHint` on the `Mission` table. All the data in the column will be lost.
  - You are about to drop the column `intent` on the `Mission` table. All the data in the column will be lost.
  - You are about to drop the column `phase` on the `Mission` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "DiscoveryRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discoveryId" TEXT NOT NULL,
    "raterUserId" TEXT NOT NULL,
    "humanInterestKeys" TEXT NOT NULL,
    "humanTagCategories" TEXT NOT NULL,
    "aiInterestKeysAtRate" TEXT NOT NULL,
    "aiTagCategoriesAtRate" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveryRating_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "Discovery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DiscoveryRating_raterUserId_fkey" FOREIGN KEY ("raterUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReliabilitySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "layer" TEXT NOT NULL,
    "kappa" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ReliabilityAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "layer" TEXT NOT NULL,
    "kappa" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "acknowledgedAt" DATETIME,
    "acknowledgedBy" TEXT,
    CONSTRAINT "ReliabilityAlert_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ReliabilitySnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReliabilityAlert_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "materials" TEXT NOT NULL,
    "tips" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "proofPhotoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Mission" ("createdAt", "day", "description", "id", "instructions", "materials", "proofPhotoUrl", "questId", "status", "tips", "title", "updatedAt") SELECT "createdAt", "day", "description", "id", "instructions", "materials", "proofPhotoUrl", "questId", "status", "tips", "title", "updatedAt" FROM "Mission";
DROP TABLE "Mission";
ALTER TABLE "new_Mission" RENAME TO "Mission";
CREATE UNIQUE INDEX "Mission_questId_day_key" ON "Mission"("questId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DiscoveryRating_createdAt_idx" ON "DiscoveryRating"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryRating_discoveryId_raterUserId_key" ON "DiscoveryRating"("discoveryId", "raterUserId");

-- CreateIndex
CREATE INDEX "ReliabilitySnapshot_layer_computedAt_idx" ON "ReliabilitySnapshot"("layer", "computedAt");

-- CreateIndex
CREATE INDEX "ReliabilityAlert_layer_createdAt_idx" ON "ReliabilityAlert"("layer", "createdAt");

-- CreateIndex
CREATE INDEX "ReliabilityAlert_acknowledgedAt_idx" ON "ReliabilityAlert"("acknowledgedAt");
