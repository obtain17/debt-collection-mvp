import { z } from "zod";

export const RiskTierSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const CollectionApproachSchema = z.enum([
  "FRIENDLY_REMINDER",
  "FIRM_NOTICE",
  "SETTLEMENT_OFFER",
  "INSTALLMENT_PLAN_PROPOSAL",
  "LEGAL_ESCALATION_RECOMMENDED",
  "MONITOR_ONLY",
]);
export const ToneSchema = z.enum(["EMPATHETIC", "NEUTRAL_FIRM", "FORMAL_FINAL_NOTICE"]);
export const ChannelSchema = z.enum(["EMAIL", "SMS", "PHONE", "LETTER", "PORTAL_MESSAGE"]);
export const RecoveryOutcomeTypeSchema = z.enum(["PARTIAL", "FULL", "UNKNOWN"]);
export const ConfidenceLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const ClaimAnalysisResultSchema = z.object({
  riskTier: RiskTierSchema,
  recoveryProbability: z.number().min(0).max(1),
  recoveryProbabilityRationale: z.string(),
  recommendedStrategy: z.object({
    approach: CollectionApproachSchema,
    suggestedTone: ToneSchema,
    suggestedChannel: ChannelSchema,
    reasoning: z.string(),
  }),
  keyRiskFactors: z.array(z.string()).max(5),
  suggestedNextActionDays: z.number().int().min(0),

  // Score explainability
  recoveryWindowDays: z.number().int().min(1),
  expectedRecoveryType: RecoveryOutcomeTypeSchema,
  confidenceLevel: ConfidenceLevelSchema,
  dataInsufficient: z.boolean(),
  dataInsufficiencyNote: z.string().optional(),
  expectedRecoveryAmount12m: z.number().int().min(0),

  // 4-metric breakdown (接触可能性/支払意思/支払能力/回収経済性)
  contactabilityScore: z.number().min(0).max(1),
  paymentWillingnessScore: z.number().min(0).max(1),
  paymentCapacityScore: z.number().min(0).max(1),
  expectedRecoveryAmount: z.number().int().min(0),
  expectedCollectionCost: z.number().int().min(0),

  // Multiple recommended actions, ordered
  recommendedActions: z
    .array(z.object({ order: z.number().int().min(1), action: z.string() }))
    .max(5),
});

export type ClaimAnalysisResult = z.infer<typeof ClaimAnalysisResultSchema>;
