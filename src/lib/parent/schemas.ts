/**
 * Zod schemas for the Parent Bridge module.
 * Validates parent-child linking, report generation, and home tips.
 */

import { z } from "zod";

/** Claim a child via access code */
export const ClaimChildSchema = z.object({
  accessCode: z.string().min(1, "Access code is required"),
});

export type ClaimChildInput = z.infer<typeof ClaimChildSchema>;

/** A single actionable home tip */
export const HomeTipSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  materials: z.array(z.string()),
  category: z.string(),
});

export type HomeTip = z.infer<typeof HomeTipSchema>;

/** Report period date range */
export const ReportPeriodSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;

/** Generate report request */
export const GenerateReportSchema = z.object({
  childId: z.string().min(1, "Child ID is required"),
  type: z.enum(["weekly", "biweekly"]),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

/** Full parent report response */
export const ParentReportSchema = z.object({
  id: z.string(),
  childId: z.string(),
  type: z.enum(["weekly", "biweekly"]),
  period: ReportPeriodSchema,
  strengths: z.array(z.string()),
  growthAreas: z.array(z.string()),
  tips: z.array(HomeTipSchema),
  summary: z.string(),
  badgeHighlights: z.array(z.string()),
  createdAt: z.string(),
  childName: z.string().optional(),
});

export type ParentReport = z.infer<typeof ParentReportSchema>;

/** Linked child summary for parent dashboard */
export const LinkedChildSchema = z.object({
  id: z.string(),
  locale: z.string(),
  claimedAt: z.string(),
  latestTalents: z.array(z.string()).optional(),
  questCount: z.number().optional(),
  badgeCount: z.number().optional(),
});

export type LinkedChild = z.infer<typeof LinkedChildSchema>;
