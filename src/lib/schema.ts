import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const ts = (name: string) =>
  integer(name, { mode: "timestamp" });

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ─── Access Codes ─────────────────────────────────────────────────────────────

export const accessCodes = sqliteTable("access_codes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  code: text("code").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  expiresAt: ts("expires_at"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ─── Children ─────────────────────────────────────────────────────────────────

export const children = sqliteTable("children", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  accessCodeId: text("access_code_id"),
  name: text("name"),
  locale: text("locale").notNull().default("id"),
  dateOfBirth: ts("date_of_birth"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ─── Discoveries ──────────────────────────────────────────────────────────────

export const discoveries = sqliteTable("discoveries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  childId: text("child_id").notNull(),
  type: text("type").notNull(),
  fileUrl: text("file_url"),
  aiAnalysis: text("ai_analysis"),
  detectedTalents: text("detected_talents"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ─── Quests ───────────────────────────────────────────────────────────────────

export const quests = sqliteTable("quests", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  childId: text("child_id").notNull(),
  discoveryId: text("discovery_id"),
  dream: text("dream").notNull(),
  localContext: text("local_context").notNull(),
  status: text("status").notNull().default("active"),
  generatedAt: ts("generated_at"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ─── Missions ─────────────────────────────────────────────────────────────────

export const missions = sqliteTable(
  "missions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    questId: text("quest_id").notNull(),
    day: integer("day").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions").notNull(),
    materials: text("materials").notNull(),
    tips: text("tips").notNull(),
    status: text("status").notNull().default("locked"),
    proofPhotoUrl: text("proof_photo_url"),
    phase: text("phase"),
    intensityHint: real("intensity_hint"),
    intent: text("intent"),
    estimatedMinutes: integer("estimated_minutes"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("missions_quest_day_idx").on(t.questId, t.day)],
);

// ─── Gallery Entries ──────────────────────────────────────────────────────────

export const galleryEntries = sqliteTable("gallery_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  childId: text("child_id").notNull(),
  questId: text("quest_id").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  talentCategory: text("talent_category").notNull(),
  country: text("country"),
  coordinates: text("coordinates"),
  questContext: text("quest_context"),
  clusterGroup: text("cluster_group"),
  talentTags: text("talent_tags"),
  createdAt: ts("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: ts("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});

// ─── Rate Limits ──────────────────────────────────────────────────────────────

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    identifier: text("identifier").notNull(),
    endpoint: text("endpoint").notNull().default("default"),
    count: integer("count").notNull().default(1),
    resetAt: ts("reset_at").notNull(),
  },
  (t) => [
    uniqueIndex("rate_limits_identifier_endpoint_idx").on(
      t.identifier,
      t.endpoint,
    ),
    index("rate_limits_reset_at_idx").on(t.resetAt),
  ],
);

// ─── Interest Signals ─────────────────────────────────────────────────────────

export const interestSignals = sqliteTable(
  "interest_signals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull().default("v1"),
    interestKey: text("interest_key").notNull(),
    source: text("source").notNull(),
    dimension: text("dimension").notNull(),
    strength: real("strength").notNull(),
    confidence: real("confidence").notNull().default(1),
    discoveryId: text("discovery_id"),
    questId: text("quest_id"),
    missionId: text("mission_id"),
    reflectionEntryId: text("reflection_entry_id"),
    galleryEntryId: text("gallery_entry_id"),
    metadataJson: text("metadata_json"),
    observedAt: ts("observed_at")
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("interest_signals_child_key_idx").on(t.childId, t.interestKey),
    index("interest_signals_child_observed_idx").on(t.childId, t.observedAt),
    index("interest_signals_source_idx").on(t.source),
  ],
);

// ─── Child Interest Profiles ──────────────────────────────────────────────────

export const childInterestProfiles = sqliteTable(
  "child_interest_profiles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull().default("v1"),
    interestKey: text("interest_key").notNull(),
    score: real("score").notNull().default(0),
    confidence: real("confidence").notNull().default(0),
    signalCount: integer("signal_count").notNull().default(0),
    distinctDays: integer("distinct_days").notNull().default(0),
    firstSignalAt: ts("first_signal_at"),
    lastSignalAt: ts("last_signal_at"),
    trend: text("trend").notNull().default("stable"),
    stability: text("stability").notNull().default("fleeting"),
    summary: text("summary"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("child_interest_profiles_unique_idx").on(
      t.childId,
      t.taxonomyVersion,
      t.interestKey,
    ),
    index("child_interest_profiles_score_idx").on(t.childId, t.score),
  ],
);

// ─── Mission Interest Assessments ────────────────────────────────────────────

export const missionInterestAssessments = sqliteTable(
  "mission_interest_assessments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull(),
    missionId: text("mission_id").notNull(),
    taxonomyVersion: text("taxonomy_version").notNull().default("v1"),
    interestKey: text("interest_key").notNull(),
    explicitRating: integer("explicit_rating"),
    parentRating: integer("parent_rating"),
    childRating: integer("child_rating"),
    observedEngagement: integer("observed_engagement"),
    notes: text("notes"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("mission_interest_assessments_unique_idx").on(
      t.childId,
      t.missionId,
      t.interestKey,
    ),
    index("mission_interest_assessments_child_mission_idx").on(
      t.childId,
      t.missionId,
    ),
  ],
);

// ─── Interest Audit Events ────────────────────────────────────────────────────

export const interestAuditEvents = sqliteTable(
  "interest_audit_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id"),
    actorUserId: text("actor_user_id"),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    metadataJson: text("metadata_json"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("interest_audit_events_child_idx").on(t.childId),
    index("interest_audit_events_event_type_idx").on(t.eventType),
    index("interest_audit_events_created_at_idx").on(t.createdAt),
  ],
);

// ─── Moderation Events ────────────────────────────────────────────────────────

export const moderationEvents = sqliteTable(
  "moderation_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    contentType: text("content_type").notNull(),
    contentHash: text("content_hash"),
    status: text("status").notNull().default("pending"),
    category: text("category"),
    severity: text("severity"),
    confidence: real("confidence"),
    aiReasoning: text("ai_reasoning"),
    childId: text("child_id"),
    reviewerId: text("reviewer_id"),
    reviewedAt: ts("reviewed_at"),
    metadata: text("metadata"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("moderation_events_source_status_idx").on(t.sourceType, t.status),
    index("moderation_events_status_created_idx").on(t.status, t.createdAt),
    index("moderation_events_child_idx").on(t.childId),
  ],
);

// ─── Mentor Sessions ──────────────────────────────────────────────────────────

export const mentorSessions = sqliteTable(
  "mentor_sessions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    missionId: text("mission_id").notNull().unique(),
    childId: text("child_id").notNull(),
    questId: text("quest_id").notNull(),
    status: text("status").notNull().default("active"),
    adjustmentCount: integer("adjustment_count").notNull().default(0),
    checkinPending: integer("checkin_pending", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("mentor_sessions_child_idx").on(t.childId),
    index("mentor_sessions_quest_idx").on(t.questId),
  ],
);

// ─── Mentor Messages ──────────────────────────────────────────────────────────

export const mentorMessages = sqliteTable(
  "mentor_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    meta: text("meta"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("mentor_messages_session_created_idx").on(t.sessionId, t.createdAt),
  ],
);

// ─── Adjustment Events ────────────────────────────────────────────────────────

export const adjustmentEvents = sqliteTable(
  "adjustment_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id").notNull(),
    missionId: text("mission_id").notNull(),
    originalInstructions: text("original_instructions").notNull(),
    simplifiedInstructions: text("simplified_instructions").notNull(),
    reason: text("reason").notNull(),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("adjustment_events_mission_idx").on(t.missionId)],
);

// ─── Reflection Entries ───────────────────────────────────────────────────────

export const reflectionEntries = sqliteTable(
  "reflection_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull(),
    questId: text("quest_id").notNull(),
    missionDay: integer("mission_day").notNull(),
    type: text("type").notNull(),
    content: text("content").notNull(),
    fileUrl: text("file_url"),
    fileExpiresAt: ts("file_expires_at"),
    aiSummary: text("ai_summary"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("reflection_entries_child_idx").on(t.childId),
    index("reflection_entries_quest_idx").on(t.questId),
    index("reflection_entries_file_expires_idx").on(t.fileExpiresAt),
  ],
);

// ─── Badges ───────────────────────────────────────────────────────────────────

export const badges = sqliteTable(
  "badges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    slug: text("slug").notNull().unique(),
    category: text("category").notNull(),
    tier: text("tier").notNull().default("bronze"),
    icon: text("icon").notNull(),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("badges_category_idx").on(t.category)],
);

// ─── Child Badges ─────────────────────────────────────────────────────────────

export const childBadges = sqliteTable(
  "child_badges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull(),
    badgeSlug: text("badge_slug").notNull(),
    questId: text("quest_id"),
    trigger: text("trigger").notNull(),
    metadata: text("metadata"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("child_badges_child_slug_idx").on(t.childId, t.badgeSlug),
    index("child_badges_child_idx").on(t.childId),
    index("child_badges_slug_idx").on(t.badgeSlug),
  ],
);

// ─── Squads ───────────────────────────────────────────────────────────────────

export const squads = sqliteTable(
  "squads",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    theme: text("theme").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull().default("🌟"),
    countries: text("countries").notNull().default("[]"),
    featuredEntryIds: text("featured_entry_ids").notNull().default("[]"),
    status: text("status").notNull().default("active"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("squads_theme_idx").on(t.theme),
    index("squads_status_idx").on(t.status),
  ],
);

// ─── Squad Members ────────────────────────────────────────────────────────────

export const squadMembers = sqliteTable(
  "squad_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    squadId: text("squad_id").notNull(),
    childId: text("child_id").notNull(),
    joinedAt: ts("joined_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("squad_members_squad_child_idx").on(t.squadId, t.childId),
    index("squad_members_child_idx").on(t.childId),
  ],
);

// ─── Parent Child ─────────────────────────────────────────────────────────────

export const parentChildren = sqliteTable(
  "parent_children",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id").notNull(),
    childId: text("child_id").notNull(),
    claimedAt: ts("claimed_at")
      .notNull()
      .$defaultFn(() => new Date()),
    consentGivenAt: ts("consent_given_at")
      .notNull()
      .$defaultFn(() => new Date()),
    consentTextVersion: text("consent_text_version").notNull().default("v1"),
  },
  (t) => [
    uniqueIndex("parent_children_user_child_idx").on(t.userId, t.childId),
    index("parent_children_user_idx").on(t.userId),
    index("parent_children_child_idx").on(t.childId),
  ],
);

// ─── Parent Reports ───────────────────────────────────────────────────────────

export const parentReports = sqliteTable(
  "parent_reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    parentId: text("parent_id").notNull(),
    childId: text("child_id").notNull(),
    type: text("type").notNull(),
    period: text("period").notNull(),
    strengths: text("strengths").notNull(),
    growthAreas: text("growth_areas").notNull(),
    tips: text("tips").notNull(),
    summary: text("summary").notNull(),
    badgeHighlights: text("badge_highlights").notNull(),
    metadata: text("metadata"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("parent_reports_parent_idx").on(t.parentId),
    index("parent_reports_child_idx").on(t.childId),
    index("parent_reports_created_idx").on(t.createdAt),
  ],
);

// ─── Parent Quest Follows ─────────────────────────────────────────────────────

export const parentQuestFollows = sqliteTable(
  "parent_quest_follows",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    parentId: text("parent_id").notNull(),
    childId: text("child_id").notNull(),
    questId: text("quest_id").notNull(),
    currentDay: integer("current_day").notNull().default(1),
    lastViewedAt: ts("last_viewed_at")
      .notNull()
      .$defaultFn(() => new Date()),
    notifications: integer("notifications", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("parent_quest_follows_parent_quest_idx").on(
      t.parentId,
      t.questId,
    ),
    index("parent_quest_follows_parent_idx").on(t.parentId),
    index("parent_quest_follows_quest_idx").on(t.questId),
  ],
);

// ─── Child ZPD State ──────────────────────────────────────────────────────────

export const childZpdStates = sqliteTable(
  "child_zpd_states",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull().unique(),
    score: real("score").notNull().default(0.3),
    band: text("band").notNull().default("developing"),
    updatedAt: ts("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("child_zpd_states_child_idx").on(t.childId)],
);

// ─── Child ZPD Snapshots ──────────────────────────────────────────────────────

export const childZpdSnapshots = sqliteTable(
  "child_zpd_snapshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    childId: text("child_id").notNull(),
    score: real("score").notNull(),
    band: text("band").notNull(),
    missionId: text("mission_id"),
    reason: text("reason").notNull(),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("child_zpd_snapshots_child_created_idx").on(t.childId, t.createdAt),
    index("child_zpd_snapshots_mission_idx").on(t.missionId),
  ],
);

// ─── Discovery Ratings ────────────────────────────────────────────────────────

export const discoveryRatings = sqliteTable(
  "discovery_ratings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    discoveryId: text("discovery_id").notNull(),
    raterUserId: text("rater_user_id").notNull(),
    humanInterestKeys: text("human_interest_keys").notNull(),
    humanTagCategories: text("human_tag_categories").notNull(),
    aiInterestKeysAtRate: text("ai_interest_keys_at_rate").notNull(),
    aiTagCategoriesAtRate: text("ai_tag_categories_at_rate").notNull(),
    notes: text("notes"),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("discovery_ratings_discovery_rater_idx").on(
      t.discoveryId,
      t.raterUserId,
    ),
    index("discovery_ratings_created_idx").on(t.createdAt),
  ],
);

// ─── Reliability Snapshots ────────────────────────────────────────────────────

export const reliabilitySnapshots = sqliteTable(
  "reliability_snapshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    computedAt: ts("computed_at")
      .notNull()
      .$defaultFn(() => new Date()),
    layer: text("layer").notNull(),
    kappa: real("kappa").notNull(),
    sampleSize: integer("sample_size").notNull(),
    payloadJson: text("payload_json").notNull(),
    triggeredBy: text("triggered_by").notNull(),
  },
  (t) => [
    index("reliability_snapshots_layer_computed_idx").on(t.layer, t.computedAt),
  ],
);

// ─── Reliability Alerts ───────────────────────────────────────────────────────

export const reliabilityAlerts = sqliteTable(
  "reliability_alerts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    createdAt: ts("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    layer: text("layer").notNull(),
    kappa: real("kappa").notNull(),
    sampleSize: integer("sample_size").notNull(),
    snapshotId: text("snapshot_id").notNull(),
    acknowledgedAt: ts("acknowledged_at"),
    acknowledgedBy: text("acknowledged_by"),
  },
  (t) => [
    index("reliability_alerts_layer_created_idx").on(t.layer, t.createdAt),
    index("reliability_alerts_acknowledged_idx").on(t.acknowledgedAt),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  parentChildren: many(parentChildren),
  parentReports: many(parentReports),
  questFollows: many(parentQuestFollows),
  interestAuditEvents: many(interestAuditEvents),
  discoveryRatings: many(discoveryRatings),
  acknowledgedAlerts: many(reliabilityAlerts),
}));

export const accessCodesRelations = relations(accessCodes, ({ many }) => ({
  children: many(children),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  accessCode: one(accessCodes, {
    fields: [children.accessCodeId],
    references: [accessCodes.id],
  }),
  discoveries: many(discoveries),
  quests: many(quests),
  galleryEntries: many(galleryEntries),
  squadMemberships: many(squadMembers),
  parentLinks: many(parentChildren),
  parentReports: many(parentReports),
  parentQuestFollows: many(parentQuestFollows),
  interestSignals: many(interestSignals),
  interestProfiles: many(childInterestProfiles),
  interestAssessments: many(missionInterestAssessments),
  zpdState: one(childZpdStates, {
    fields: [children.id],
    references: [childZpdStates.childId],
  }),
  zpdSnapshots: many(childZpdSnapshots),
}));

export const discoveriesRelations = relations(discoveries, ({ one, many }) => ({
  child: one(children, {
    fields: [discoveries.childId],
    references: [children.id],
  }),
  quests: many(quests),
  interestSignals: many(interestSignals),
  ratings: many(discoveryRatings),
}));

export const questsRelations = relations(quests, ({ one, many }) => ({
  child: one(children, {
    fields: [quests.childId],
    references: [children.id],
  }),
  discovery: one(discoveries, {
    fields: [quests.discoveryId],
    references: [discoveries.id],
  }),
  missions: many(missions),
  galleryEntry: one(galleryEntries, {
    fields: [quests.id],
    references: [galleryEntries.questId],
  }),
  parentFollows: many(parentQuestFollows),
  interestSignals: many(interestSignals),
}));

export const missionsRelations = relations(missions, ({ one, many }) => ({
  quest: one(quests, {
    fields: [missions.questId],
    references: [quests.id],
  }),
  mentorSession: one(mentorSessions, {
    fields: [missions.id],
    references: [mentorSessions.missionId],
  }),
  adjustmentEvents: many(adjustmentEvents),
  interestAssessments: many(missionInterestAssessments),
  interestSignals: many(interestSignals),
}));

export const galleryEntriesRelations = relations(
  galleryEntries,
  ({ one, many }) => ({
    child: one(children, {
      fields: [galleryEntries.childId],
      references: [children.id],
    }),
    quest: one(quests, {
      fields: [galleryEntries.questId],
      references: [quests.id],
    }),
    interestSignals: many(interestSignals),
  }),
);

export const interestSignalsRelations = relations(
  interestSignals,
  ({ one }) => ({
    child: one(children, {
      fields: [interestSignals.childId],
      references: [children.id],
    }),
    discovery: one(discoveries, {
      fields: [interestSignals.discoveryId],
      references: [discoveries.id],
    }),
    quest: one(quests, {
      fields: [interestSignals.questId],
      references: [quests.id],
    }),
    mission: one(missions, {
      fields: [interestSignals.missionId],
      references: [missions.id],
    }),
    reflectionEntry: one(reflectionEntries, {
      fields: [interestSignals.reflectionEntryId],
      references: [reflectionEntries.id],
    }),
    galleryEntry: one(galleryEntries, {
      fields: [interestSignals.galleryEntryId],
      references: [galleryEntries.id],
    }),
  }),
);

export const childInterestProfilesRelations = relations(
  childInterestProfiles,
  ({ one }) => ({
    child: one(children, {
      fields: [childInterestProfiles.childId],
      references: [children.id],
    }),
  }),
);

export const missionInterestAssessmentsRelations = relations(
  missionInterestAssessments,
  ({ one }) => ({
    child: one(children, {
      fields: [missionInterestAssessments.childId],
      references: [children.id],
    }),
    mission: one(missions, {
      fields: [missionInterestAssessments.missionId],
      references: [missions.id],
    }),
  }),
);

export const interestAuditEventsRelations = relations(
  interestAuditEvents,
  ({ one }) => ({
    actorUser: one(users, {
      fields: [interestAuditEvents.actorUserId],
      references: [users.id],
    }),
  }),
);

export const mentorSessionsRelations = relations(
  mentorSessions,
  ({ one, many }) => ({
    mission: one(missions, {
      fields: [mentorSessions.missionId],
      references: [missions.id],
    }),
    messages: many(mentorMessages),
    adjustments: many(adjustmentEvents),
  }),
);

export const mentorMessagesRelations = relations(mentorMessages, ({ one }) => ({
  session: one(mentorSessions, {
    fields: [mentorMessages.sessionId],
    references: [mentorSessions.id],
  }),
}));

export const adjustmentEventsRelations = relations(
  adjustmentEvents,
  ({ one }) => ({
    session: one(mentorSessions, {
      fields: [adjustmentEvents.sessionId],
      references: [mentorSessions.id],
    }),
    mission: one(missions, {
      fields: [adjustmentEvents.missionId],
      references: [missions.id],
    }),
  }),
);

export const reflectionEntriesRelations = relations(
  reflectionEntries,
  ({ many }) => ({
    interestSignals: many(interestSignals),
  }),
);

export const squadsRelations = relations(squads, ({ many }) => ({
  members: many(squadMembers),
}));

export const squadMembersRelations = relations(squadMembers, ({ one }) => ({
  squad: one(squads, {
    fields: [squadMembers.squadId],
    references: [squads.id],
  }),
  child: one(children, {
    fields: [squadMembers.childId],
    references: [children.id],
  }),
}));

export const parentChildrenRelations = relations(parentChildren, ({ one }) => ({
  user: one(users, {
    fields: [parentChildren.userId],
    references: [users.id],
  }),
  child: one(children, {
    fields: [parentChildren.childId],
    references: [children.id],
  }),
}));

export const parentReportsRelations = relations(parentReports, ({ one }) => ({
  parent: one(users, {
    fields: [parentReports.parentId],
    references: [users.id],
  }),
  child: one(children, {
    fields: [parentReports.childId],
    references: [children.id],
  }),
}));

export const parentQuestFollowsRelations = relations(
  parentQuestFollows,
  ({ one }) => ({
    parent: one(users, {
      fields: [parentQuestFollows.parentId],
      references: [users.id],
    }),
    child: one(children, {
      fields: [parentQuestFollows.childId],
      references: [children.id],
    }),
    quest: one(quests, {
      fields: [parentQuestFollows.questId],
      references: [quests.id],
    }),
  }),
);

export const childZpdStatesRelations = relations(childZpdStates, ({ one }) => ({
  child: one(children, {
    fields: [childZpdStates.childId],
    references: [children.id],
  }),
}));

export const childZpdSnapshotsRelations = relations(
  childZpdSnapshots,
  ({ one }) => ({
    child: one(children, {
      fields: [childZpdSnapshots.childId],
      references: [children.id],
    }),
  }),
);

export const discoveryRatingsRelations = relations(
  discoveryRatings,
  ({ one }) => ({
    discovery: one(discoveries, {
      fields: [discoveryRatings.discoveryId],
      references: [discoveries.id],
    }),
    rater: one(users, {
      fields: [discoveryRatings.raterUserId],
      references: [users.id],
    }),
  }),
);

export const reliabilitySnapshotsRelations = relations(
  reliabilitySnapshots,
  ({ many }) => ({
    alerts: many(reliabilityAlerts),
  }),
);

export const reliabilityAlertsRelations = relations(
  reliabilityAlerts,
  ({ one }) => ({
    snapshot: one(reliabilitySnapshots, {
      fields: [reliabilityAlerts.snapshotId],
      references: [reliabilitySnapshots.id],
    }),
    ackUser: one(users, {
      fields: [reliabilityAlerts.acknowledgedBy],
      references: [users.id],
    }),
  }),
);
