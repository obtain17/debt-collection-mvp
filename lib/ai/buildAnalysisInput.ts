import { differenceInDays } from "date-fns";
import type { ActivityLog, Claim, Debtor, Payment } from "@/generated/prisma/client";

export interface ClaimAnalysisInput {
  claim: {
    claimType: string;
    principalAmount: number;
    currentBalance: number;
    currency: string;
    originalDueDate: string;
    daysOverdue: number;
    hasCollateral: boolean;
    collateralDescription: string | null;
    priorDefaultCount: number;
  };
  debtor: {
    type: string;
    ageBracket: string | null;
    occupation: string | null;
    industry: string | null;
    employeeCountBracket: string | null;
    yearsInBusiness: number | null;
  };
  interactionHistory: Array<{
    date: string;
    channel: string;
    type: string;
    summary: string;
  }>;
  paymentHistory: Array<{ date: string; amount: number }>;
}

type ClaimWithRelations = Claim & {
  debtor: Debtor;
  payments: Payment[];
  activityLogs: ActivityLog[];
};

const MAX_INTERACTIONS = 20;

export function buildAnalysisInput(claim: ClaimWithRelations): ClaimAnalysisInput {
  const now = new Date();

  const interactionHistory = claim.activityLogs
    .slice(0, MAX_INTERACTIONS)
    .map((log) => {
      const metadata = (log.metadata ?? {}) as Record<string, unknown>;
      const channel = typeof metadata.channel === "string" ? metadata.channel : "SYSTEM";
      return {
        date: log.createdAt.toISOString(),
        channel,
        type: log.type,
        summary: log.description,
      };
    });

  const paymentHistory = claim.payments.map((payment) => ({
    date: payment.paidAt.toISOString(),
    amount: payment.amount,
  }));

  return {
    claim: {
      claimType: claim.claimType,
      principalAmount: claim.principalAmount,
      currentBalance: claim.currentBalance,
      currency: claim.currency,
      originalDueDate: claim.originalDueDate.toISOString(),
      daysOverdue: Math.max(0, differenceInDays(now, claim.originalDueDate)),
      hasCollateral: claim.hasCollateral,
      collateralDescription: claim.collateralDescription,
      priorDefaultCount: claim.priorDefaultCount,
    },
    debtor: {
      type: claim.debtor.type,
      ageBracket: claim.debtor.ageBracket,
      occupation: claim.debtor.occupation,
      industry: claim.debtor.industry,
      employeeCountBracket: claim.debtor.employeeCountBracket,
      yearsInBusiness: claim.debtor.yearsInBusiness,
    },
    interactionHistory,
    paymentHistory,
  };
}
