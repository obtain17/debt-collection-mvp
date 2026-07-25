"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getClaimByPortalToken, getPortalSession } from "@/lib/portal/validateToken";
import { generateScheduleFromProposal } from "@/lib/schedule/generateScheduleFromProposal";
import { cancelPendingCommunications } from "@/lib/dunning/cancelPendingCommunications";
import {
  MAX_VERIFICATION_ATTEMPTS,
  checkClaimReference,
  checkDateOfBirth,
  checkOtp,
  checkPhoneLast4,
  checkSecretQuestion,
  generateOtp,
} from "@/lib/portal/verifyIdentity";
import type { $Enums } from "@/generated/prisma/client";

export async function sendOtpAction(token: string) {
  const session = await getPortalSession(token);
  if (!session) throw new Error("リンクが無効です");
  if (session.accessToken.identityVerifiedAt) return;

  await generateOtp(session.accessToken.id, session.claim.id);
  revalidatePath(`/portal/${token}`);
}

export async function verifyIdentity(token: string, formData: FormData) {
  const session = await getPortalSession(token);
  if (!session) throw new Error("リンクが無効です");
  const { accessToken, claim } = session;

  if (accessToken.identityVerifiedAt) return;
  if (accessToken.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
    throw new Error("試行回数の上限に達しました。お手数ですが担当者までお問い合わせください。");
  }

  const method = String(formData.get("method") ?? "") as $Enums.IdentityVerificationMethod;
  const input = String(formData.get("value") ?? "").trim();

  let success = false;
  switch (method) {
    case "PHONE_LAST4":
      success = checkPhoneLast4(claim.debtor, input);
      break;
    case "DATE_OF_BIRTH":
      success = checkDateOfBirth(claim.debtor, input);
      break;
    case "CLAIM_REFERENCE":
      success = checkClaimReference(claim.id, input);
      break;
    case "SECRET_QUESTION":
      success = checkSecretQuestion(claim.debtor, input);
      break;
    case "OTP":
      success = checkOtp(accessToken, input);
      break;
    default:
      success = false;
  }

  if (!success) {
    await prisma.negotiationAccessToken.update({
      where: { id: accessToken.id },
      data: { verificationAttempts: { increment: 1 } },
    });
    throw new Error("確認できませんでした。入力内容をご確認のうえ再度お試しください。");
  }

  const verifiedAt = new Date();
  await prisma.negotiationAccessToken.update({
    where: { id: accessToken.id },
    data: { identityVerifiedAt: verifiedAt, identityVerificationMethod: method },
  });
  await prisma.debtor.update({
    where: { id: claim.debtorId },
    data: {
      identityVerificationStatus: "VERIFIED",
      identityVerifiedAt: verifiedAt,
      identityVerificationMethod: method,
    },
  });
  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      type: "PORTAL_ACCESSED",
      description: `債務者ポータルで本人確認が完了しました(方法: ${method})`,
      metadata: { method },
    },
  });

  revalidatePath(`/portal/${token}`);
}

export async function submitProposal(token: string, formData: FormData) {
  const claim = await getClaimByPortalToken(token);
  if (!claim) throw new Error("リンクが無効です");

  const kind = String(formData.get("kind") ?? "installment");

  let installments: Array<{ month: number; amount: number }>;
  let totalAmount: number;
  let settlementOffer: boolean;

  if (kind === "settlement") {
    const amount = Math.max(0, Math.round(Number(formData.get("settlementAmount") ?? 0)));
    installments = [{ month: 1, amount }];
    totalAmount = amount;
    settlementOffer = true;
  } else {
    const count = Math.min(24, Math.max(1, Math.round(Number(formData.get("installmentCount") ?? 1))));
    const base = Math.floor(claim.currentBalance / count);
    const remainder = claim.currentBalance - base * count;
    installments = Array.from({ length: count }, (_, i) => ({
      month: i + 1,
      amount: i === count - 1 ? base + remainder : base,
    }));
    totalAmount = claim.currentBalance;
    settlementOffer = false;
  }

  const numberOrUndefined = (value: FormDataEntryValue | null) =>
    value != null && value !== "" ? Math.round(Number(value)) : undefined;
  const bonusMonths = formData
    .getAll("bonusMonths")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  const firstPaymentDateRaw = String(formData.get("firstPaymentDate") ?? "");

  await prisma.paymentPlanProposal.create({
    data: {
      claimId: claim.id,
      proposedBy: "DEBTOR",
      installments,
      totalAmount,
      settlementOffer,
      status: "PENDING_REVIEW",
      monthlyIncome: numberOrUndefined(formData.get("monthlyIncome")),
      takeHomeIncome: numberOrUndefined(formData.get("takeHomeIncome")),
      rent: numberOrUndefined(formData.get("rent")),
      dependentsCount: numberOrUndefined(formData.get("dependentsCount")),
      otherDebtRepayment: numberOrUndefined(formData.get("otherDebtRepayment")),
      affordableMonthlyAmount: numberOrUndefined(formData.get("affordableMonthlyAmount")),
      desiredPaymentDay: numberOrUndefined(formData.get("desiredPaymentDay")),
      bonusMonths,
      firstPaymentDate: firstPaymentDateRaw ? new Date(firstPaymentDateRaw) : undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      type: "PROPOSAL_SUBMITTED",
      description: settlementOffer
        ? `債務者よりポータル経由で一括和解案(${totalAmount.toLocaleString("ja-JP")}円)の提案がありました`
        : `債務者よりポータル経由で分割払い案(${installments.length}回)の提案がありました`,
      metadata: { channel: "PORTAL_MESSAGE" },
    },
  });

  if (claim.status === "ACTIVE") {
    await prisma.claim.update({ where: { id: claim.id }, data: { status: "IN_NEGOTIATION" } });
  }

  revalidatePath(`/portal/${token}`);
}

export async function consentToSettlement(token: string, proposalId: string, formData: FormData) {
  const claim = await getClaimByPortalToken(token);
  if (!claim) throw new Error("リンクが無効です");

  const proposal = await prisma.paymentPlanProposal.findFirst({
    where: { id: proposalId, claimId: claim.id },
  });
  if (!proposal) throw new Error("提案が見つかりません");
  if (proposal.status !== "APPROVED") throw new Error("この提案はまだ承認されていません");
  if (proposal.debtorConsentedAt) throw new Error("すでに同意済みです");

  const consentName = String(formData.get("consentName") ?? "").trim();
  const agreed = formData.get("agreed") === "on";
  if (!agreed) throw new Error("同意チェックボックスにチェックを入れてください");
  if (!consentName) throw new Error("氏名を入力してください");
  if (consentName !== claim.debtor.name) {
    throw new Error("入力された氏名がご登録の氏名と一致しません");
  }

  const consentedAt = new Date();
  await prisma.paymentPlanProposal.update({
    where: { id: proposalId },
    data: { debtorConsentedAt: consentedAt, debtorConsentName: consentName },
  });

  await generateScheduleFromProposal(claim.id, {
    installments: proposal.installments,
    firstPaymentDate: proposal.firstPaymentDate,
    desiredPaymentDay: proposal.desiredPaymentDay,
  });

  const cancelledCount = await cancelPendingCommunications(claim.id, "返済合意成立のため自動督促を停止しました");

  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      type: "PROPOSAL_REVIEWED",
      description: `債務者の電子同意により返済合意が成立しました(督促${cancelledCount}件を停止)`,
      metadata: { proposalId, consentName },
    },
  });

  revalidatePath(`/portal/${token}`);
}
