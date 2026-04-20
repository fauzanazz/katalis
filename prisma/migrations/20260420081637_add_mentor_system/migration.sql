-- CreateTable
CREATE TABLE "MentorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "adjustmentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MentorSession_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MentorMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MentorSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdjustmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "originalInstructions" TEXT NOT NULL,
    "simplifiedInstructions" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdjustmentEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MentorSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdjustmentEvent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReflectionEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "missionDay" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fileUrl" TEXT,
    "aiSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorSession_missionId_key" ON "MentorSession"("missionId");

-- CreateIndex
CREATE INDEX "MentorSession_childId_idx" ON "MentorSession"("childId");

-- CreateIndex
CREATE INDEX "MentorSession_questId_idx" ON "MentorSession"("questId");

-- CreateIndex
CREATE INDEX "MentorMessage_sessionId_createdAt_idx" ON "MentorMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AdjustmentEvent_missionId_idx" ON "AdjustmentEvent"("missionId");

-- CreateIndex
CREATE INDEX "ReflectionEntry_childId_idx" ON "ReflectionEntry"("childId");

-- CreateIndex
CREATE INDEX "ReflectionEntry_questId_idx" ON "ReflectionEntry"("questId");
