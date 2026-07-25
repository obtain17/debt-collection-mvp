import { prisma } from "@/lib/db/prisma";
import { analyzeClaimRisk } from "./claimAnalysis";
import { buildAnalysisInput } from "./buildAnalysisInput";
import { isAiConfigured, getAiModel } from "./client";

/**
 * Fetches a claim with the relations the analyzer needs, calls the AI module,
 * and persists the result. Used by both the seed script and the on-demand
 * "re-analyze" API route so the persistence logic lives in exactly one place.
 */
export async function runClaimAnalysis(claimId: string, actingUserId?: string): Promise<void> {
  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: {
      debtor: true,
      payments: true,
      activityLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!isAiConfigured()) {
    const analysis = await prisma.claimAnalysis.create({
      data: { claimId: claim.id, status: "NOT_ANALYZED", modelUsed: getAiModel() },
    });
    await prisma.claim.update({
      where: { id: claim.id },
      data: { latestAnalysisId: analysis.id },
    });
    return;
  }

  const input = buildAnalysisInput(claim);

  try {
    const result = await analyzeClaimRisk(input);

    const analysis = await prisma.claimAnalysis.create({
      data: {
        claimId: claim.id,
        status: "COMPLETE",
        riskTier: result.riskTier,
        recoveryProbability: result.recoveryProbability,
        recoveryProbabilityRationale: result.recoveryProbabilityRationale,
        recommendedApproach: result.recommendedStrategy.approach,
        suggestedTone: result.recommendedStrategy.suggestedTone,
        suggestedChannel: result.recommendedStrategy.suggestedChannel,
        reasoning: result.recommendedStrategy.reasoning,
        keyRiskFactors: result.keyRiskFactors,
        suggestedNextActionDays: result.suggestedNextActionDays,
        recoveryWindowDays: result.recoveryWindowDays,
        expectedRecoveryType: result.expectedRecoveryType,
        confidenceLevel: result.confidenceLevel,
        dataInsufficient: result.dataInsufficient,
        dataInsufficiencyNote: result.dataInsufficiencyNote,
        expectedRecoveryAmount12m: result.expectedRecoveryAmount12m,
        contactabilityScore: result.contactabilityScore,
        paymentWillingnessScore: result.paymentWillingnessScore,
        paymentCapacityScore: result.paymentCapacityScore,
        expectedRecoveryAmount: result.expectedRecoveryAmount,
        expectedCollectionCost: result.expectedCollectionCost,
        recommendedActions: result.recommendedActions,
        rawModelResponse: result,
        modelUsed: getAiModel(),
      },
    });

    await prisma.claim.update({
      where: { id: claim.id },
      data: { latestAnalysisId: analysis.id },
    });

    await prisma.activityLog.create({
      data: {
        claimId: claim.id,
        userId: actingUserId,
        type: "AI_ANALYSIS_RUN",
        description: `AI分析を実行しました(リスク: ${result.riskTier} / 回収可能性: ${Math.round(result.recoveryProbability * 100)}%)`,
        metadata: { analysisId: analysis.id },
      },
    });
  } catch (error) {
    const analysis = await prisma.claimAnalysis.create({
      data: {
        claimId: claim.id,
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        modelUsed: getAiModel(),
      },
    });
    await prisma.claim.update({
      where: { id: claim.id },
      data: { latestAnalysisId: analysis.id },
    });
  }
}
