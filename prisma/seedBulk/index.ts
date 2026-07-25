import { faker } from "@faker-js/faker";
import { prisma } from "../../lib/db/prisma";
import { chunkArray } from "./chunk";
import { generateDebtor } from "./generateDebtor";
import { generateClaim } from "./generateClaim";
import { generateSyntheticAnalysis } from "./generateSyntheticAnalysis";
import { generateActivityLogs } from "./generateActivityLogs";
import { pickSampleForUpcoming } from "./generateScheduledCommunications";

const DEBTOR_CHUNK = 1000;
const CLAIM_CHUNK = 500;
const ANALYSIS_CHUNK = 500;
const ACTIVITY_CHUNK = 2000;
const UPCOMING_SAMPLE_PER_ORG = 100;

export interface BulkOrgConfig {
  organizationId: string;
  dunningRuleId: string;
  agentIds: string[];
  debtorSkew: "individual" | "company";
}

/**
 * Generates a large volume of synthetic debtors/claims/analyses/activity for
 * PoC demo purposes, split evenly across `orgs`. Deliberately bypasses the
 * per-claim helpers used for the ~30 hand-authored showcase cases
 * (scheduleForClaim, runClaimAnalysis) since those await sequentially per
 * record; at 5,000 records that would mean tens of thousands of DB
 * round-trips and, if an API key is configured, 5,000 real LLM calls. Instead
 * everything is built in memory and inserted with chunked createMany calls.
 */
export async function seedBulkDemoData(
  orgs: BulkOrgConfig[],
  totalClaims: number,
  startingVirtualAccountNumber: number,
): Promise<void> {
  if (totalClaims <= 0 || orgs.length === 0) return;

  const perOrg = Math.floor(totalClaims / orgs.length);
  let vAccount = startingVirtualAccountNumber;
  let globalSeq = 0;

  for (const org of orgs) {
    console.log(`  バルクデモデータ生成中(組織 ${org.organizationId}, ${perOrg}件)...`);

    const debtorRows = Array.from({ length: perOrg }, () => {
      globalSeq += 1;
      return generateDebtor(globalSeq, org.organizationId, org.debtorSkew);
    });
    for (const chunk of chunkArray(debtorRows, DEBTOR_CHUNK)) {
      await prisma.debtor.createMany({ data: chunk });
    }

    const claimRows = debtorRows.map((debtor) => {
      vAccount += 1;
      const assignedAgentId = org.agentIds.length > 0 ? faker.helpers.arrayElement(org.agentIds) : null;
      return generateClaim({
        debtorId: debtor.id,
        debtorType: debtor.type,
        organizationId: org.organizationId,
        assignedAgentId,
        dunningRuleId: org.dunningRuleId,
        virtualAccountNumber: vAccount,
      });
    });
    for (const chunk of chunkArray(claimRows, CLAIM_CHUNK)) {
      await prisma.claim.createMany({ data: chunk });
    }

    const analysisRows = claimRows.map((claim) =>
      generateSyntheticAnalysis({
        claimId: claim.id,
        status: claim.status,
        originalDueDate: claim.originalDueDate,
        principalAmount: claim.principalAmount,
        currentBalance: claim.currentBalance,
        hasCollateral: claim.hasCollateral,
        priorDefaultCount: claim.priorDefaultCount,
      }),
    );
    for (const chunk of chunkArray(analysisRows, ANALYSIS_CHUNK)) {
      await prisma.claimAnalysis.createMany({ data: chunk });
    }

    // Claim.latestAnalysisId <-> ClaimAnalysis.claimId is a circular FK, so
    // Claims were inserted above with latestAnalysisId left null. Link them
    // now in one statement per org (the IS NULL guard leaves the ~30
    // hand-authored, really-analyzed claims untouched).
    await prisma.$executeRaw`
      UPDATE "Claim" c
      SET "latestAnalysisId" = ca.id
      FROM "ClaimAnalysis" ca
      WHERE ca."claimId" = c.id
        AND c."organizationId" = ${org.organizationId}
        AND c."latestAnalysisId" IS NULL
    `;

    const analysisByClaimId = new Map(analysisRows.map((a) => [a.claimId, a]));
    const activityRows = claimRows.flatMap((claim) => {
      const analysis = analysisByClaimId.get(claim.id)!;
      return generateActivityLogs({
        claimId: claim.id,
        userId: claim.assignedAgentId,
        status: claim.status,
        riskTier: analysis.riskTier,
        recoveryProbability: analysis.recoveryProbability,
        analysisId: analysis.id,
        originalDueDate: claim.originalDueDate,
      });
    });
    for (const chunk of chunkArray(activityRows, ACTIVITY_CHUNK)) {
      await prisma.activityLog.createMany({ data: chunk });
    }

    const upcoming = pickSampleForUpcoming(
      claimRows.map((c) => ({ id: c.id, status: c.status })),
      UPCOMING_SAMPLE_PER_ORG,
    );
    if (upcoming.length > 0) {
      await prisma.scheduledCommunication.createMany({ data: upcoming });
    }

    console.log(`  組織 ${org.organizationId}: ${perOrg}件のデモデータ生成が完了しました。`);
  }
}
