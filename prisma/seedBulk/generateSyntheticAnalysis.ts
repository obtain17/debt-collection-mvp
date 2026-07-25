import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { differenceInDays } from "date-fns";
import type { $Enums } from "../../generated/prisma/client";
import {
  RISK_FACTOR_POOL,
  RECOMMENDED_ACTION_POOL,
  APPROACH_BY_TIER,
  TONE_BY_TIER,
  CHANNEL_BY_TIER,
  REASONING_POOL,
} from "./pools/riskFactors";

/** How far a synthetic score is allowed to drift from its deterministic base, biased toward the middle via a 3-sample average. */
function jitter(spread: number): number {
  const a = faker.number.float({ min: 0, max: 1 });
  const b = faker.number.float({ min: 0, max: 1 });
  const c = faker.number.float({ min: 0, max: 1 });
  return (((a + b + c) / 3) * 2 - 1) * spread;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export interface SyntheticAnalysisInput {
  claimId: string;
  status: $Enums.ClaimStatus;
  originalDueDate: Date;
  principalAmount: number;
  currentBalance: number;
  hasCollateral: boolean;
  priorDefaultCount: number;
}

export interface SyntheticAnalysisRow {
  id: string;
  claimId: string;
  status: "COMPLETE";
  riskTier: $Enums.RiskTier;
  recoveryProbability: number;
  recoveryProbabilityRationale: string;
  recommendedApproach: $Enums.CollectionApproach;
  suggestedTone: $Enums.Tone;
  suggestedChannel: $Enums.Channel;
  reasoning: string;
  keyRiskFactors: string[];
  suggestedNextActionDays: number;
  recoveryWindowDays: number;
  expectedRecoveryType: $Enums.RecoveryOutcomeType;
  confidenceLevel: $Enums.ConfidenceLevel;
  dataInsufficient: boolean;
  expectedRecoveryAmount12m: number;
  contactabilityScore: number;
  paymentWillingnessScore: number;
  paymentCapacityScore: number;
  expectedRecoveryAmount: number;
  expectedCollectionCost: number;
  recommendedActions: Array<{ order: number; action: string }>;
  modelUsed: string;
}

/**
 * Heuristic stand-in for the real analyzeClaimRisk() LLM call, used only for
 * bulk demo volume (5,000 records would mean 5,000 real API calls otherwise).
 * Uses the same feature set as buildAnalysisInput.ts so score distributions
 * stay plausible next to the ~30 hand-authored cases that DO get real AI
 * analysis. Tagged with modelUsed = "synthetic-demo-seed" for traceability.
 */
export function generateSyntheticAnalysis(input: SyntheticAnalysisInput): SyntheticAnalysisRow {
  const daysOverdue = Math.max(0, differenceInDays(new Date(), input.originalDueDate));
  const overdueNorm = clamp01(daysOverdue / 120);
  const balanceRatio = input.currentBalance / Math.max(input.principalAmount, 1);

  let riskScore =
    overdueNorm * 0.5 + (input.priorDefaultCount / 3) * 0.2 + balanceRatio * 0.15 - (input.hasCollateral ? 0.15 : 0);

  if (input.status === "LEGAL_ESCALATION") riskScore += 0.25;
  if (input.status === "SETTLED") riskScore = 0.05;
  if (input.status === "WRITTEN_OFF") riskScore = 0.9;

  riskScore = clamp01(riskScore + jitter(0.1));

  const riskTier: $Enums.RiskTier =
    riskScore < 0.35 ? "LOW" : riskScore < 0.6 ? "MEDIUM" : riskScore < 0.8 ? "HIGH" : "CRITICAL";

  const contactabilityScore = clamp01(1 - riskScore * 0.6 + jitter(0.1));
  const paymentWillingnessScore = clamp01(1 - riskScore * 0.8 + jitter(0.1));
  const paymentCapacityScore = clamp01(1 - riskScore * 0.5 - balanceRatio * 0.1 + jitter(0.1));

  const recoveryProbability =
    input.status === "SETTLED"
      ? 1
      : input.status === "WRITTEN_OFF"
        ? clamp01(0.05 + jitter(0.05))
        : clamp01(contactabilityScore * 0.3 + paymentWillingnessScore * 0.4 + paymentCapacityScore * 0.3);

  const expectedRecoveryAmount = Math.round(input.currentBalance * recoveryProbability);
  const expectedRecoveryAmount12m = Math.round(
    expectedRecoveryAmount * faker.number.float({ min: 0.9, max: 1.15 }),
  );
  const expectedCollectionCost = Math.round(expectedRecoveryAmount * faker.number.float({ min: 0.03, max: 0.08 }));

  const nextActionDaysBase = { LOW: 14, MEDIUM: 7, HIGH: 3, CRITICAL: 1 }[riskTier];
  const recoveryWindowDaysBase = { LOW: 90, MEDIUM: 60, HIGH: 30, CRITICAL: 14 }[riskTier];

  const confidenceLevel: $Enums.ConfidenceLevel = faker.helpers.weightedArrayElement([
    { value: "MEDIUM", weight: 6 },
    { value: "HIGH", weight: 3 },
    { value: "LOW", weight: 1 },
  ]);

  const expectedRecoveryType: $Enums.RecoveryOutcomeType =
    input.status === "SETTLED" || recoveryProbability > 0.7
      ? "FULL"
      : recoveryProbability > 0.2
        ? "PARTIAL"
        : "UNKNOWN";

  const keyRiskFactorsPool = RISK_FACTOR_POOL[riskTier];
  const keyRiskFactors = faker.helpers.arrayElements(keyRiskFactorsPool, {
    min: 2,
    max: Math.min(3, keyRiskFactorsPool.length),
  });

  const actionPool = RECOMMENDED_ACTION_POOL[riskTier];
  const actions = faker.helpers.arrayElements(actionPool, { min: 2, max: Math.min(3, actionPool.length) });

  return {
    id: randomUUID(),
    claimId: input.claimId,
    status: "COMPLETE",
    riskTier,
    recoveryProbability,
    recoveryProbabilityRationale: REASONING_POOL[riskTier],
    recommendedApproach: APPROACH_BY_TIER[riskTier],
    suggestedTone: TONE_BY_TIER[riskTier],
    suggestedChannel: CHANNEL_BY_TIER[riskTier],
    reasoning: REASONING_POOL[riskTier],
    keyRiskFactors,
    suggestedNextActionDays: Math.max(0, nextActionDaysBase + faker.number.int({ min: -2, max: 2 })),
    recoveryWindowDays: Math.max(1, recoveryWindowDaysBase + faker.number.int({ min: -10, max: 10 })),
    expectedRecoveryType,
    confidenceLevel,
    dataInsufficient: false,
    expectedRecoveryAmount12m,
    contactabilityScore,
    paymentWillingnessScore,
    paymentCapacityScore,
    expectedRecoveryAmount,
    expectedCollectionCost,
    recommendedActions: actions.map((action, i) => ({ order: i + 1, action })),
    modelUsed: "synthetic-demo-seed",
  };
}
