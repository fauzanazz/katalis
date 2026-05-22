-- CreateTable
CREATE TABLE "InterestSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL DEFAULT 'v1',
    "interestKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "strength" REAL NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1,
    "discoveryId" TEXT,
    "questId" TEXT,
    "missionId" TEXT,
    "reflectionEntryId" TEXT,
    "galleryEntryId" TEXT,
    "metadataJson" TEXT,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterestSignal_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InterestSignal_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "Discovery" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InterestSignal_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InterestSignal_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InterestSignal_reflectionEntryId_fkey" FOREIGN KEY ("reflectionEntryId") REFERENCES "ReflectionEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InterestSignal_galleryEntryId_fkey" FOREIGN KEY ("galleryEntryId") REFERENCES "GalleryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChildInterestProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL DEFAULT 'v1',
    "interestKey" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "lastSignalAt" DATETIME,
    "trend" TEXT NOT NULL DEFAULT 'stable',
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChildInterestProfile_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionInterestAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "taxonomyVersion" TEXT NOT NULL DEFAULT 'v1',
    "interestKey" TEXT NOT NULL,
    "explicitRating" INTEGER,
    "parentRating" INTEGER,
    "childRating" INTEGER,
    "observedEngagement" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MissionInterestAssessment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionInterestAssessment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterestAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterestAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InterestSignal_childId_interestKey_idx" ON "InterestSignal"("childId", "interestKey");

-- CreateIndex
CREATE INDEX "InterestSignal_childId_observedAt_idx" ON "InterestSignal"("childId", "observedAt");

-- CreateIndex
CREATE INDEX "InterestSignal_source_idx" ON "InterestSignal"("source");

-- CreateIndex
CREATE INDEX "ChildInterestProfile_childId_score_idx" ON "ChildInterestProfile"("childId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "ChildInterestProfile_childId_taxonomyVersion_interestKey_key" ON "ChildInterestProfile"("childId", "taxonomyVersion", "interestKey");

-- CreateIndex
CREATE INDEX "MissionInterestAssessment_childId_missionId_idx" ON "MissionInterestAssessment"("childId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionInterestAssessment_childId_missionId_interestKey_key" ON "MissionInterestAssessment"("childId", "missionId", "interestKey");

-- CreateIndex
CREATE INDEX "InterestAuditEvent_childId_idx" ON "InterestAuditEvent"("childId");

-- CreateIndex
CREATE INDEX "InterestAuditEvent_eventType_idx" ON "InterestAuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "InterestAuditEvent_createdAt_idx" ON "InterestAuditEvent"("createdAt");
