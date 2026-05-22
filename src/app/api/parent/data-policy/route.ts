import { NextResponse } from "next/server";

import {
  DATA_RETENTION_DESCRIPTIONS,
  DATA_RETENTION_POLICY,
} from "@/lib/parent/data-retention";

/**
 * GET /api/parent/data-policy
 *
 * Exposes the retention windows and deletion SLA so the parent dashboard
 * can surface them transparently. Public read — no auth required because
 * the policy itself is not sensitive.
 *
 * Spec ref: Katalis.docx §8.3c.
 */
export function GET() {
  return NextResponse.json({
    policy: DATA_RETENTION_POLICY,
    descriptions: DATA_RETENTION_DESCRIPTIONS,
    deletionEndpoint: "/api/parent/children/{childId}/data-deletion",
    interestResetEndpoint: "/api/parent/children/{childId}/interests (DELETE)",
  });
}
