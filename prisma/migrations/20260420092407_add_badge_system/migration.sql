-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "icon" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChildBadge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "badgeSlug" TEXT NOT NULL,
    "questId" TEXT,
    "trigger" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge"("slug");

-- CreateIndex
CREATE INDEX "Badge_category_idx" ON "Badge"("category");

-- CreateIndex
CREATE INDEX "ChildBadge_childId_idx" ON "ChildBadge"("childId");

-- CreateIndex
CREATE INDEX "ChildBadge_badgeSlug_idx" ON "ChildBadge"("badgeSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ChildBadge_childId_badgeSlug_key" ON "ChildBadge"("childId", "badgeSlug");
