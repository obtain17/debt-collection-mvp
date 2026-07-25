import { prisma } from "@/lib/db/prisma";
import { allocatePayment } from "./allocatePayment";
import { postPaymentAutomation } from "./postPaymentAutomation";
import { formatYen } from "@/lib/format";
import type { $Enums } from "@/generated/prisma/client";

export interface CreatePaymentInput {
  claimId: string;
  amount: number;
  paidAt: Date;
  source?: string;
  payerName?: string;
  matchStatus?: $Enums.DepositMatchStatus;
  incomingDepositId?: string;
  confirmedByUserId?: string;
}

/**
 * The single place a Payment row gets created from (manual case-level entry,
 * or a resolved IncomingDeposit) so allocation snapshotting and the
 * post-payment automation always run together.
 */
export async function createPaymentForClaim(input: CreatePaymentInput) {
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: input.claimId } });
  const allocation = allocatePayment(input.amount, claim);

  const payment = await prisma.payment.create({
    data: {
      claimId: input.claimId,
      amount: input.amount,
      paidAt: input.paidAt,
      source: input.source ?? "手動入力",
      payerName: input.payerName,
      matchStatus: input.matchStatus ?? "MATCHED",
      incomingDepositId: input.incomingDepositId,
      allocationBreakdown: allocation,
      confirmedByUserId: input.confirmedByUserId,
      confirmedAt: input.confirmedByUserId ? new Date() : undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      claimId: input.claimId,
      userId: input.confirmedByUserId,
      type: "PAYMENT_RECEIVED",
      description: `入金を記録しました(${formatYen(input.amount)})`,
      metadata: { paymentId: payment.id, matchStatus: payment.matchStatus },
    },
  });

  await postPaymentAutomation(input.claimId, input.amount, payment.id, input.paidAt);

  return payment;
}
