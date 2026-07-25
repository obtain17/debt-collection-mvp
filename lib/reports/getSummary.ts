import { prisma } from "@/lib/db/prisma";

export interface ReportSummary {
  recoveryRate: number;
  totalPrincipal: number;
  totalRecovered: number;
  statusFunnel: Array<{ status: string; count: number }>;
  riskDistribution: Array<{ riskTier: string; count: number }>;
}

export async function getReportSummary(organizationId: string): Promise<ReportSummary> {
  const [claims, paymentSum, statusGroups, riskGroups] = await Promise.all([
    prisma.claim.aggregate({ where: { organizationId }, _sum: { principalAmount: true } }),
    prisma.payment.aggregate({
      where: { claim: { organizationId }, reversedAt: null },
      _sum: { amount: true },
    }),
    prisma.claim.groupBy({ by: ["status"], where: { organizationId }, _count: { _all: true } }),
    prisma.claim.groupBy({
      by: ["latestAnalysisId"],
      where: { organizationId, latestAnalysisId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const totalPrincipal = claims._sum.principalAmount ?? 0;
  const totalRecovered = paymentSum._sum.amount ?? 0;
  const recoveryRate = totalPrincipal > 0 ? totalRecovered / totalPrincipal : 0;

  const statusFunnel = statusGroups.map((g) => ({ status: g.status, count: g._count._all }));

  const analysisIds = riskGroups.map((g) => g.latestAnalysisId).filter((id): id is string => Boolean(id));
  const analyses = await prisma.claimAnalysis.findMany({
    where: { id: { in: analysisIds } },
    select: { id: true, riskTier: true },
  });
  const riskByAnalysisId = new Map(analyses.map((a) => [a.id, a.riskTier]));

  const riskCounts = new Map<string, number>();
  for (const g of riskGroups) {
    const tier = g.latestAnalysisId ? riskByAnalysisId.get(g.latestAnalysisId) : null;
    const key = tier ?? "UNANALYZED";
    riskCounts.set(key, (riskCounts.get(key) ?? 0) + g._count._all);
  }

  const noAnalysisCount = await prisma.claim.count({
    where: { organizationId, latestAnalysisId: null },
  });
  if (noAnalysisCount > 0) {
    riskCounts.set("UNANALYZED", (riskCounts.get("UNANALYZED") ?? 0) + noAnalysisCount);
  }

  const riskDistribution = Array.from(riskCounts.entries()).map(([riskTier, count]) => ({ riskTier, count }));

  return { recoveryRate, totalPrincipal, totalRecovered, statusFunnel, riskDistribution };
}
