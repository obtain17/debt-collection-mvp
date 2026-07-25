"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/auth/getSession";
import { extractDepositsFromImage, type ExtractedDeposit } from "@/lib/ai/extractDepositsFromImage";
import { matchDeposit } from "@/lib/payments/matchDeposit";
import { createPaymentForClaim } from "@/lib/payments/createPaymentForClaim";
import { reversePayment } from "@/lib/payments/reversePayment";
import type { $Enums } from "@/generated/prisma/client";

async function processExtractedDeposit(
  organizationId: string,
  userId: string,
  dep: ExtractedDeposit,
  source: string,
): Promise<void> {
  const match = await matchDeposit(organizationId, { amount: dep.amount, payerName: dep.payerName });
  const depositedAt = Number.isNaN(Date.parse(dep.date)) ? new Date() : new Date(dep.date);

  const deposit = await prisma.incomingDeposit.create({
    data: {
      organizationId,
      amount: dep.amount,
      payerName: dep.payerName,
      depositedAt,
      source,
      matchStatus: match ? match.matchStatus : "UNMATCHED",
    },
  });

  if (match) {
    await createPaymentForClaim({
      claimId: match.claimId,
      amount: dep.amount,
      paidAt: depositedAt,
      source,
      payerName: dep.payerName,
      matchStatus: match.matchStatus,
      incomingDepositId: deposit.id,
      confirmedByUserId: userId,
    });
    await prisma.incomingDeposit.update({
      where: { id: deposit.id },
      data: { resolvedByUserId: userId, resolvedAt: new Date() },
    });
  }
}

export async function importDepositsFromImageAction(formData: FormData) {
  const session = await requireSession();
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) throw new Error("画像を選択してください");

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = file.type || "image/png";

  const deposits = await extractDepositsFromImage(base64, mediaType);
  for (const dep of deposits) {
    await processExtractedDeposit(session.organizationId, session.userId, dep, "画像取込");
  }

  revalidatePath("/deposits");
}

export async function importManualDepositAction(formData: FormData) {
  const session = await requireSession();
  const amount = Math.round(Number(formData.get("amount") ?? 0));
  const payerName = String(formData.get("payerName") ?? "").trim();
  const virtualAccountNumber = String(formData.get("virtualAccountNumber") ?? "").trim();
  const depositedAtRaw = String(formData.get("depositedAt") ?? "");
  if (!amount || amount <= 0 || !depositedAtRaw) throw new Error("金額と入金日を入力してください");

  const depositedAt = new Date(depositedAtRaw);
  const match = await matchDeposit(session.organizationId, {
    amount,
    payerName: payerName || null,
    virtualAccountNumber: virtualAccountNumber || null,
  });

  const deposit = await prisma.incomingDeposit.create({
    data: {
      organizationId: session.organizationId,
      amount,
      payerName: payerName || null,
      virtualAccountNumber: virtualAccountNumber || null,
      depositedAt,
      source: "手動入力",
      matchStatus: match ? match.matchStatus : "UNMATCHED",
    },
  });

  if (match) {
    await createPaymentForClaim({
      claimId: match.claimId,
      amount,
      paidAt: depositedAt,
      source: "手動入力",
      payerName: payerName || undefined,
      matchStatus: match.matchStatus,
      incomingDepositId: deposit.id,
      confirmedByUserId: session.userId,
    });
    await prisma.incomingDeposit.update({
      where: { id: deposit.id },
      data: { resolvedByUserId: session.userId, resolvedAt: new Date() },
    });
  }

  revalidatePath("/deposits");
}

export async function resolveDepositAction(formData: FormData) {
  const session = await requireSession();
  const depositId = String(formData.get("depositId") ?? "");
  const claimId = String(formData.get("claimId") ?? "");
  if (!depositId || !claimId) throw new Error("案件を選択してください");

  const deposit = await prisma.incomingDeposit.findFirst({
    where: { id: depositId, organizationId: session.organizationId },
  });
  if (!deposit) throw new Error("入金が見つかりません");
  if (deposit.matchStatus !== "UNMATCHED") throw new Error("すでに処理済みです");

  const claim = await prisma.claim.findFirst({ where: { id: claimId, organizationId: session.organizationId } });
  if (!claim) throw new Error("案件が見つかりません");

  const matchStatus: $Enums.DepositMatchStatus =
    deposit.amount < claim.currentBalance ? "PARTIAL" : deposit.amount > claim.currentBalance ? "OVERPAID" : "MATCHED";

  await createPaymentForClaim({
    claimId,
    amount: deposit.amount,
    paidAt: deposit.depositedAt,
    source: deposit.source,
    payerName: deposit.payerName ?? undefined,
    matchStatus,
    incomingDepositId: deposit.id,
    confirmedByUserId: session.userId,
  });

  await prisma.incomingDeposit.update({
    where: { id: depositId },
    data: { matchStatus, resolvedByUserId: session.userId, resolvedAt: new Date() },
  });

  revalidatePath("/deposits");
}

export async function reversePaymentAction(formData: FormData) {
  const session = await requireSession();
  const paymentId = String(formData.get("paymentId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, claim: { organizationId: session.organizationId } },
  });
  if (!payment) throw new Error("入金が見つかりません");

  await reversePayment(paymentId, session.userId, reason);
  revalidatePath("/deposits");
}
