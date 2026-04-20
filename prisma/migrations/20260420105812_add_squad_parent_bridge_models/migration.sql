-- AlterTable
ALTER TABLE "GalleryEntry" ADD COLUMN "talentTags" TEXT;

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🌟',
    "countries" TEXT NOT NULL DEFAULT '[]',
    "featuredEntryIds" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SquadMember_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParentChild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParentReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "growthAreas" TEXT NOT NULL,
    "tips" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "badgeHighlights" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParentReport_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentReport_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Squad_theme_idx" ON "Squad"("theme");

-- CreateIndex
CREATE INDEX "Squad_status_idx" ON "Squad"("status");

-- CreateIndex
CREATE INDEX "SquadMember_childId_idx" ON "SquadMember"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_squadId_childId_key" ON "SquadMember"("squadId", "childId");

-- CreateIndex
CREATE INDEX "ParentChild_userId_idx" ON "ParentChild"("userId");

-- CreateIndex
CREATE INDEX "ParentChild_childId_idx" ON "ParentChild"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentChild_userId_childId_key" ON "ParentChild"("userId", "childId");

-- CreateIndex
CREATE INDEX "ParentReport_parentId_idx" ON "ParentReport"("parentId");

-- CreateIndex
CREATE INDEX "ParentReport_childId_idx" ON "ParentReport"("childId");

-- CreateIndex
CREATE INDEX "ParentReport_createdAt_idx" ON "ParentReport"("createdAt");
