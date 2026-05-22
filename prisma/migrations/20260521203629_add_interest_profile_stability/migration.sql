-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "intensityHint" REAL;
ALTER TABLE "Mission" ADD COLUMN "intent" TEXT;
ALTER TABLE "Mission" ADD COLUMN "phase" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChildInterestProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL DEFAULT 'v1',
    "interestKey" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "distinctDays" INTEGER NOT NULL DEFAULT 0,
    "firstSignalAt" DATETIME,
    "lastSignalAt" DATETIME,
    "trend" TEXT NOT NULL DEFAULT 'stable',
    "stability" TEXT NOT NULL DEFAULT 'fleeting',
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChildInterestProfile_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChildInterestProfile" ("childId", "confidence", "createdAt", "id", "interestKey", "lastSignalAt", "score", "signalCount", "summary", "taxonomyVersion", "trend", "updatedAt") SELECT "childId", "confidence", "createdAt", "id", "interestKey", "lastSignalAt", "score", "signalCount", "summary", "taxonomyVersion", "trend", "updatedAt" FROM "ChildInterestProfile";
DROP TABLE "ChildInterestProfile";
ALTER TABLE "new_ChildInterestProfile" RENAME TO "ChildInterestProfile";
CREATE INDEX "ChildInterestProfile_childId_score_idx" ON "ChildInterestProfile"("childId", "score");
CREATE UNIQUE INDEX "ChildInterestProfile_childId_taxonomyVersion_interestKey_key" ON "ChildInterestProfile"("childId", "taxonomyVersion", "interestKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
