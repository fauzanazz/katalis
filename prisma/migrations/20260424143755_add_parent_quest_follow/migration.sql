-- CreateTable
CREATE TABLE "ParentQuestFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "lastViewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ParentQuestFollow_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentQuestFollow_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentQuestFollow_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ParentQuestFollow_parentId_idx" ON "ParentQuestFollow"("parentId");

-- CreateIndex
CREATE INDEX "ParentQuestFollow_questId_idx" ON "ParentQuestFollow"("questId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentQuestFollow_parentId_questId_key" ON "ParentQuestFollow"("parentId", "questId");
