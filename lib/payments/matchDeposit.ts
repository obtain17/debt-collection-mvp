import { prisma } from "@/lib/db/prisma";
import type { $Enums } from "@/generated/prisma/client";

function normalize(name: string): string {
  return name.normalize("NFKC").replace(/[\s　]/g, "");
}

export interface DepositMatchResult {
  claimId: string;
  matchStatus: $Enums.DepositMatchStatus;
}

/**
 * Tries to resolve a raw deposit to exactly one claim: first by exact
 * virtual account number, then by a normalized substring match between the
 * payer name and the debtor's name. Multi-claim splits are left to manual
 * resolution in the /deposits UI.
 */
export async function matchDeposit(
  organizationId: string,
  input: { amount: number; payerName?: string | null; virtualAccountNumber?: string | null },
): Promise<DepositMatchResult | null> {
  let claim: { id: string; currentBalance: number } | null = null;

  if (input.virtualAccountNumber) {
    claim = await prisma.claim.findFirst({
      where: { organizationId, virtualAccountNumber: input.virtualAccountNumber },
      select: { id: true, currentBalance: true },
    });
  }

  if (!claim && input.payerName) {
    const normalizedPayer = normalize(input.payerName);
    const candidates = await prisma.claim.findMany({
      where: { organizationId, status: { notIn: ["SETTLED", "WRITTEN_OFF"] } },
      include: { debtor: true },
    });
    const found = candidates.find((c) => {
      const normalizedDebtor = normalize(c.debtor.name);
      return (
        normalizedDebtor.length > 0 &&
        (normalizedPayer.includes(normalizedDebtor) || normalizedDebtor.includes(normalizedPayer))
      );
    });
    claim = found ? { id: found.id, currentBalance: found.currentBalance } : null;
  }

  if (!claim) return null;

  let matchStatus: $Enums.DepositMatchStatus = "MATCHED";
  if (input.amount < claim.currentBalance) matchStatus = "PARTIAL";
  else if (input.amount > claim.currentBalance) matchStatus = "OVERPAID";

  return { claimId: claim.id, matchStatus };
}
