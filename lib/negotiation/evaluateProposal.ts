import type { NegotiationRule } from "@/generated/prisma/client";

export type NegotiationVerdict =
  | "WITHIN_POLICY"
  | "SUPERVISOR_APPROVAL_REQUIRED"
  | "LEGAL_APPROVAL_REQUIRED"
  | "NOT_OFFERABLE";

export interface ProposalEvaluation {
  discountRate: number;
  installmentCount: number;
  monthlyAmount: number;
  verdict: NegotiationVerdict;
  reasons: string[];
}

const VERDICT_RANK: Record<NegotiationVerdict, number> = {
  WITHIN_POLICY: 0,
  SUPERVISOR_APPROVAL_REQUIRED: 1,
  LEGAL_APPROVAL_REQUIRED: 2,
  NOT_OFFERABLE: 3,
};

function escalate(current: NegotiationVerdict, next: NegotiationVerdict): NegotiationVerdict {
  return VERDICT_RANK[next] > VERDICT_RANK[current] ? next : current;
}

/**
 * Evaluates a payment plan proposal against the organization's negotiation
 * policy and returns a display-only verdict (社内ルール内/上長承認必要/
 * 法務承認必要/提示不可) plus the reasons for it. This never blocks the
 * approve/reject buttons — staff make the final call, per the source
 * requirement that these labels are informational ("画面上には...を表示").
 */
export function evaluateProposal(
  proposal: { totalAmount: number; installments: unknown },
  claim: { currentBalance: number },
  rule: Pick<
    NegotiationRule,
    "maxDiscountRate" | "maxInstallments" | "minMonthlyAmount" | "noApprovalMaxDiscountRate" | "supervisorApprovalMaxDiscountRate"
  >,
): ProposalEvaluation {
  const discountRate =
    claim.currentBalance > 0 ? Math.max(0, 1 - proposal.totalAmount / claim.currentBalance) : 0;
  const installmentCount = Array.isArray(proposal.installments) ? proposal.installments.length : 1;
  const monthlyAmount = Math.floor(proposal.totalAmount / Math.max(1, installmentCount));

  let verdict: NegotiationVerdict = "WITHIN_POLICY";
  const reasons: string[] = [];

  if (discountRate > rule.maxDiscountRate) {
    verdict = escalate(verdict, "NOT_OFFERABLE");
    reasons.push(`減額率${pct(discountRate)}が上限${pct(rule.maxDiscountRate)}を超過しています`);
  } else if (discountRate > rule.supervisorApprovalMaxDiscountRate) {
    verdict = escalate(verdict, "LEGAL_APPROVAL_REQUIRED");
    reasons.push(`減額率${pct(discountRate)}は法務承認が必要な水準です`);
  } else if (discountRate > rule.noApprovalMaxDiscountRate) {
    verdict = escalate(verdict, "SUPERVISOR_APPROVAL_REQUIRED");
    reasons.push(`減額率${pct(discountRate)}は上長承認が必要な水準です`);
  }

  if (installmentCount > rule.maxInstallments) {
    verdict = escalate(verdict, "SUPERVISOR_APPROVAL_REQUIRED");
    reasons.push(`分割回数${installmentCount}回が上限${rule.maxInstallments}回を超過しています`);
  }

  if (monthlyAmount < rule.minMonthlyAmount) {
    verdict = escalate(verdict, "SUPERVISOR_APPROVAL_REQUIRED");
    reasons.push(`月額${monthlyAmount.toLocaleString("ja-JP")}円が最低月額を下回っています`);
  }

  return { discountRate, installmentCount, monthlyAmount, verdict, reasons };
}

function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
