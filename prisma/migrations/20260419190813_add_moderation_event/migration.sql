-- CreateTable
CREATE TABLE "ModerationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "contentType" TEXT NOT NULL,
    "contentHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "category" TEXT,
    "severity" TEXT,
    "confidence" REAL,
    "aiReasoning" TEXT,
    "childId" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" DATETIME,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ModerationEvent_sourceType_status_idx" ON "ModerationEvent"("sourceType", "status");

-- CreateIndex
CREATE INDEX "ModerationEvent_status_createdAt_idx" ON "ModerationEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_childId_idx" ON "ModerationEvent"("childId");
