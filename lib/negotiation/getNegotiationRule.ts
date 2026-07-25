import { prisma } from "@/lib/db/prisma";
import type { NegotiationRule } from "@/generated/prisma/client";

const DEFAULT_RULE: Omit<NegotiationRule, "id" | "organizationId" | "updatedAt"> = {
  allowPrincipalReduction: false,
  allowInterestWaiver: true,
  allowLateDamageWaiver: true,
  maxDiscountRate: 0.3,
  maxInstallments: 24,
  minMonthlyAmount: 10_000,
  firstPaymentDeadlineDays: 30,
  noApprovalMaxDiscountRate: 0.1,
  supervisorApprovalMaxDiscountRate: 0.2,
};

/**
 * Returns the organization's negotiation policy, falling back to sensible
 * defaults when no row has been configured yet (avoids needing to backfill
 * every organization with a settings row).
 */
export async function getNegotiationRule(
  organizationId: string,
): Promise<Omit<NegotiationRule, "id" | "organizationId" | "updatedAt">> {
  const rule = await prisma.negotiationRule.findUnique({ where: { organizationId } });
  return rule ?? DEFAULT_RULE;
}
