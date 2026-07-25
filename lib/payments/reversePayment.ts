import { prisma } from "@/lib/db/prisma";

/**
 * Reverses a previously recorded payment: restores the claim's balance (and
 * re-opens the claim if it had been marked SETTLED because of this payment),
 * frees up any repayment-schedule item it had fulfilled, and logs the
 * reversal. The Payment row itself is kept (not deleted) for audit purposes.
 */
export async function reversePayment(paymentId: string, userId: string, reason: string): Promise<void> {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.reversedAt) throw new Error("すでに取消済みです");

  await prisma.payment.update({
    where: { id: paymentId },
    data: { reversedAt: new Date(), reversedByUserId: userId, reversalReason: reason || null, matchStatus: "REVERSED" },
  });

  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: payment.claimId } });
  const restoredBalance = claim.currentBalance + payment.amount;
  await prisma.claim.update({
    where: { id: payment.claimId },
    data: {
      currentBalance: restoredBalance,
      status: claim.status === "SETTLED" && restoredBalance > 0 ? "ACTIVE" : claim.status,
    },
  });

  const scheduleItem = await prisma.paymentScheduleItem.findUnique({ where: { paymentId } });
  if (scheduleItem) {
    await prisma.paymentScheduleItem.update({
      where: { id: scheduleItem.id },
      data: { status: "PENDING", paidAt: null, paymentId: null },
    });
  }

  await prisma.activityLog.create({
    data: {
      claimId: payment.claimId,
      userId,
      type: "STATUS_CHANGE",
      description: `入金の取消(理由: ${reason || "なし"})`,
      metadata: { paymentId },
    },
  });
}
