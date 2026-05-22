/**
 * Data retention and deletion policy.
 *
 * Spec ref: Katalis.docx §8.3c — "All data retention policies should be
 * clearly communicated; parents can request deletion at any time."
 *
 * These constants define the windows the platform commits to. Surface them
 * in the parent dashboard and honor them in cleanup jobs.
 */

export const DATA_RETENTION_POLICY = {
  /** Mentor chat messages older than this are eligible for purge. */
  mentorMessageDays: 180,
  /** Reflection entries older than this are eligible for purge. */
  reflectionDays: 365,
  /** Discovery artifacts (image/audio) older than this are purged from storage. */
  discoveryArtifactDays: 365,
  /** Interest signals older than this are aggregated and pruned. */
  interestSignalDays: 730,
  /** Audit events kept for compliance — never auto-purged below this. */
  auditMinimumDays: 730,
  /**
   * Service Level Agreement to fulfill a parent's deletion request, measured
   * from request acknowledgement.
   */
  deletionFulfillmentSlaDays: 30,
} as const;

export type DataRetentionPolicy = typeof DATA_RETENTION_POLICY;

/**
 * Human-readable summary surfaced to parents in their dashboard.
 */
export const DATA_RETENTION_DESCRIPTIONS: Record<keyof DataRetentionPolicy, string> = {
  mentorMessageDays:
    "We keep mentor chats for up to 6 months so your child can revisit favorite conversations. Older messages are removed automatically.",
  reflectionDays:
    "Your child's written reflections stay for up to a year so they can look back on their growth. Older reflections are removed.",
  discoveryArtifactDays:
    "Photos and recordings of your child's creations are removed from our storage after a year.",
  interestSignalDays:
    "The behavioral signals that power the interest engine are aggregated after two years; raw signals are then removed.",
  auditMinimumDays:
    "Action logs (who did what) are kept for at least two years for safety and accountability.",
  deletionFulfillmentSlaDays:
    "If you ask us to delete your child's data, we'll fully remove it from our systems within 30 days.",
};
