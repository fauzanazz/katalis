-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Child" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessCodeId" TEXT,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'id',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Child_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Child" ("accessCodeId", "createdAt", "id", "locale", "updatedAt") SELECT "accessCodeId", "createdAt", "id", "locale", "updatedAt" FROM "Child";
DROP TABLE "Child";
ALTER TABLE "new_Child" RENAME TO "Child";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
