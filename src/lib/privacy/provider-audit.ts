/**
 * Audit log for external AI provider calls involving child content.
 *
 * COPPA compliance requires operators to document what data is shared with
 * third parties and for what purpose. This module emits structured audit
 * events each time child content (image, audio, story text) is dispatched
 * to an external AI provider.
 *
 * Current: console-only (structured JSON so log aggregators can ingest).
 * Future:  write to `aiProviderAuditLog` DB table — add model + migration first.
 */

export type ArtifactType = "image" | "audio" | "story";

export interface ProviderAuditParams {
  /** AI provider name — "openai" | "anthropic" | "google" | etc. */
  provider: string;
  /** What kind of child content is being sent */
  artifactType: ArtifactType;
  /** Operation performed — "analyze_artifact" | "analyze_story" | "generate_quest" */
  operation: string;
  /** Child row id for compliance traceability (never include PII like name/email) */
  childId?: string;
  /** Discovery row id for post-hoc audit of specific submissions */
  discoveryId?: string;
  /** Approximate payload size in bytes (image data URL length) */
  byteSize?: number;
  /** Whether EXIF was stripped before sending */
  exifStripped?: boolean;
}

/**
 * Emit a structured audit event for an external provider call.
 * Call immediately before dispatching to the provider.
 */
export function logProviderCall(params: ProviderAuditParams): void {
  console.log(
    "[AI_PROVIDER_AUDIT]",
    JSON.stringify({
      ...params,
      ts: new Date().toISOString(),
      env: process.env.NODE_ENV,
    }),
  );
}
