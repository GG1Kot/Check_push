import { z } from "zod/v4";

export const ChangeTypeSchema = z.enum([
  "FEATURE", "BUG_FIX", "REFACTOR", "SECURITY", "PERFORMANCE", "UI", "DATABASE",
  "INFRASTRUCTURE", "DOCUMENTATION", "TESTS", "DEPENDENCIES", "OTHER",
]);
export const ImpactLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const AIAnalysisSchema = z.object({
  headline: z.string().max(100),
  shortSummary: z.string().max(450),
  whatChanged: z.string().max(1800),
  whyItMatters: z.string().max(1400),
  technicalChanges: z.array(z.string().max(220)).max(12),
  changeType: ChangeTypeSchema,
  impactLevel: ImpactLevelSchema,
  impactReason: z.string().max(550),
  affectedAreas: z.array(z.string().max(80)).max(10),
  warnings: z.array(z.string().max(180)).max(10),
});

export type AIAnalysisResult = z.infer<typeof AIAnalysisSchema>;

export const SummarySchema = z.object({
  summary: z.string().max(2200),
  highlights: z.array(z.string().max(180)).max(12),
  important: z.array(z.string().max(180)).max(10),
});

export const AskSchema = z.object({
  answer: z.string().max(3500),
  insufficientData: z.boolean(),
  relevantEventIds: z.array(z.string()).max(20),
});
