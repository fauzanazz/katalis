-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "phase" TEXT;
ALTER TABLE "Mission" ADD COLUMN "intensityHint" REAL;
ALTER TABLE "Mission" ADD COLUMN "intent" TEXT;

-- CreateTable
CREATE TABLE "ChildZpdState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0.30,
    "band" TEXT NOT NULL DEFAULT 'developing',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChildZpdState_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChildZpdSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "band" TEXT NOT NULL,
    "missionId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChildZpdSnapshot_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildZpdState_childId_key" ON "ChildZpdState"("childId");

-- CreateIndex
CREATE INDEX "ChildZpdState_childId_idx" ON "ChildZpdState"("childId");

-- CreateIndex
CREATE INDEX "ChildZpdSnapshot_childId_createdAt_idx" ON "ChildZpdSnapshot"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "ChildZpdSnapshot_missionId_idx" ON "ChildZpdSnapshot"("missionId");
