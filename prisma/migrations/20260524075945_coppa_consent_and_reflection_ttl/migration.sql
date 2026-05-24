-- AlterTable
ALTER TABLE "ReflectionEntry" ADD COLUMN "fileExpiresAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ParentChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentGivenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentTextVersion" TEXT NOT NULL DEFAULT 'v1',
    CONSTRAINT "ParentChild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentChild_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ParentChild" ("childId", "claimedAt", "id", "userId") SELECT "childId", "claimedAt", "id", "userId" FROM "ParentChild";
DROP TABLE "ParentChild";
ALTER TABLE "new_ParentChild" RENAME TO "ParentChild";
CREATE INDEX "ParentChild_userId_idx" ON "ParentChild"("userId");
CREATE INDEX "ParentChild_childId_idx" ON "ParentChild"("childId");
CREATE UNIQUE INDEX "ParentChild_userId_childId_key" ON "ParentChild"("userId", "childId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ReflectionEntry_fileExpiresAt_idx" ON "ReflectionEntry"("fileExpiresAt");
