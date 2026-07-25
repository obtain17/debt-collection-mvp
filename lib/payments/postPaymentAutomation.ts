import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/prisma";
import { runClaimAnalysis } from "@/lib/ai/runClaimAnalysis";
import { cancelPendingCommunications } from "@/lib/dunning/cancelPendingCommunications";
import { formatYen } from "@/lib/format";

/**
 * Marks as many of the oldest unpaid schedule items as PAID as this single
 * payment can fully cover, in due-date order (e.g. a lump-sum payoff should
 * clear every remaining installment, not just the next one).
 */
async function reconcileScheduleItems(
  claimId: string,
  paymentId: string,
  amount: number,
  paidAt: Date,
): Promise<void> {
  const items = await prisma.paymentScheduleItem.findMany({
    where: { claimId, status: { in: ["PENDING", "OVERDUE"] } },
    orderBy: { dueDate: "asc" },
  });

  let remaining = amount;
  let isFirst = true;
  for (const item of items) {
    if (remaining < item.amount) break;
    remaining -= item.amount;
    await prisma.paymentScheduleItem.update({
      where: { id: item.id },
      // paymentId is @unique (one schedule item per payment), so only the
      // first item this payment settles gets the direct link; the rest just
      // get marked PAID (a lump sum can clear more than one installment).
      data: { status: "PAID", paidAt, paymentId: isFirst ? paymentId : undefined },
    });
    isFirst = false;
  }
}

async function sendReceiptNotification(claimId: string): Promise<void> {
  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { debtor: true, organization: true },
  });

  let sentByEmail = false;
  if (claim.debtor.email) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "localhost",
        port: Number(process.env.SMTP_PORT || 1025),
        secure: false,
      });
      await transporter.sendMail({
        from: `"${claim.organization.name}" <no-reply@example.com>`,
        to: claim.debtor.email,
        subject: `【${claim.organization.name}】ご入金のお知らせ`,
        text: [
          `${claim.debtor.name} 様`,
          "",
          "ご入金を確認いたしました。ありがとうございます。",
          `現在の残高: ${formatYen(claim.currentBalance)}`,
          "",
          claim.organization.name,
        ].join("\n"),
      });
      sentByEmail = true;
    } catch {
      sentByEmail = false;
    }
  }

  await prisma.activityLog.create({
    data: {
      claimId,
      type: "COMMUNICATION_SENT",
      description: sentByEmail ? "領収通知メールを送信しました" : "領収通知(シミュレート)を記録しました",
      metadata: { channel: "EMAIL", simulated: !sentByEmail },
    },
  });
}

/**
 * Everything that should automatically follow a recorded payment (項目14):
 * update the running balance, reconcile the repayment schedule if one
 * exists, close the case out if it's now fully paid, re-run AI scoring, and
 * notify the debtor. Secondary steps (AI, email) are individually guarded so
 * a failure there can never undo the payment itself.
 */
export async function postPaymentAutomation(
  claimId: string,
  paymentAmount: number,
  paymentId: string,
  paidAt: Date,
): Promise<void> {
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: claimId } });
  const newBalance = Math.max(0, claim.currentBalance - paymentAmount);

  await prisma.claim.update({ where: { id: claimId }, data: { currentBalance: newBalance } });

  await reconcileScheduleItems(claimId, paymentId, paymentAmount, paidAt);

  if (newBalance <= 0 && claim.status !== "SETTLED") {
    await prisma.claim.update({ where: { id: claimId }, data: { status: "SETTLED" } });
    const cancelledCount = await cancelPendingCommunications(claimId, "完済のため自動督促を停止しました");
    await prisma.activityLog.create({
      data: {
        claimId,
        type: "STATUS_CHANGE",
        description: `完済しました(督促${cancelledCount}件を停止)`,
      },
    });
  }

  try {
    await runClaimAnalysis(claimId);
  } catch {
    // AI re-scoring is best-effort; the payment itself must still succeed.
  }

  await sendReceiptNotification(claimId);
}
