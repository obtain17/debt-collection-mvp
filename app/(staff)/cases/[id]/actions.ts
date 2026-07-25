"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import { ensureAccessToken } from "@/lib/portal/ensureAccessToken";
import { runClaimAnalysis } from "@/lib/ai/runClaimAnalysis";
import { COMPLIANCE_FLAG_LABEL, CONTACT_EVENT_LABEL } from "@/lib/format";
import { checkProhibitedExpressions } from "@/lib/dunning/prohibitedExpressions";
import { createPaymentForClaim } from "@/lib/payments/createPaymentForClaim";
import type { $Enums } from "@/generated/prisma/client";

async function assertClaimInOrg(claimId: string, organizationId: string) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, organizationId } });
  if (!claim) throw new Error("ケースが見つかりません");
  return claim;
}

export async function addNote(claimId: string, formData: FormData) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.note.create({ data: { claimId, userId: session.userId, body } });
  await prisma.activityLog.create({
    data: { claimId, userId: session.userId, type: "NOTE_ADDED", description: "メモを追加しました" },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function issuePortalLink(claimId: string) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);

  const token = await ensureAccessToken(claimId);
  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "PORTAL_ACCESSED",
      description: "交渉ポータルのリンクを発行しました",
    },
  });

  revalidatePath(`/cases/${claimId}`);
  return token;
}

export async function reviewProposal(
  claimId: string,
  proposalId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote: string,
) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);

  const proposal = await prisma.paymentPlanProposal.update({
    where: { id: proposalId },
    data: {
      status: decision,
      reviewedByUserId: session.userId,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    },
  });

  if (decision === "APPROVED") {
    await prisma.claim.update({
      where: { id: claimId },
      data: { status: proposal.settlementOffer ? "PLAN_AGREED" : "PLAN_AGREED" },
    });
  }

  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "PROPOSAL_REVIEWED",
      description: decision === "APPROVED" ? "返済提案を承認しました" : "返済提案を却下しました",
      metadata: { proposalId },
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function reanalyzeClaimAction(claimId: string) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);
  await runClaimAnalysis(claimId, session.userId);
  revalidatePath(`/cases/${claimId}`);
}

export async function updateClaimStatus(claimId: string, status: $Enums.ClaimStatus) {
  const session = await requireSession();
  requireRole(session, "ADMIN");
  await assertClaimInOrg(claimId, session.organizationId);

  await prisma.claim.update({ where: { id: claimId }, data: { status } });
  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "STATUS_CHANGE",
      description: `ステータスを「${status}」に変更しました`,
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function setComplianceFlag(
  claimId: string,
  flagType: $Enums.ComplianceFlagType,
  reason: string,
) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);

  await prisma.complianceFlag.create({
    data: { claimId, flagType, reason: reason || null, setByUserId: session.userId },
  });

  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "COMPLIANCE_FLAG_SET",
      description: `コンプライアンスフラグ「${COMPLIANCE_FLAG_LABEL[flagType]}」を設定しました`,
      metadata: { flagType, reason: reason || null },
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function logContactEvent(claimId: string, formData: FormData) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);

  const type = formData.get("type") as $Enums.ActivityType;
  const note = String(formData.get("note") ?? "").trim();
  if (!type || !(type in CONTACT_EVENT_LABEL)) return;

  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type,
      description: note ? `${CONTACT_EVENT_LABEL[type]}: ${note}` : CONTACT_EVENT_LABEL[type],
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function recordPayment(claimId: string, formData: FormData) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);

  const amount = Math.round(Number(formData.get("amount") ?? 0));
  const paidAtRaw = String(formData.get("paidAt") ?? "");
  if (!amount || amount <= 0 || !paidAtRaw) return;
  const paidAt = new Date(paidAtRaw);

  await createPaymentForClaim({
    claimId,
    amount,
    paidAt,
    source: "手動入力",
    confirmedByUserId: session.userId,
  });

  revalidatePath(`/cases/${claimId}`);
}

async function assertCommunicationInOrg(scheduledCommunicationId: string, organizationId: string) {
  const sc = await prisma.scheduledCommunication.findFirst({
    where: { id: scheduledCommunicationId, claim: { organizationId } },
  });
  if (!sc) throw new Error("督促スケジュールが見つかりません");
  return sc;
}

export async function editCommunicationContent(
  claimId: string,
  scheduledCommunicationId: string,
  formData: FormData,
) {
  const session = await requireSession();
  await assertClaimInOrg(claimId, session.organizationId);
  const sc = await assertCommunicationInOrg(scheduledCommunicationId, session.organizationId);
  if (sc.status !== "DRAFT_PENDING_REVIEW") throw new Error("この項目は編集できません");

  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  const mailClassRaw = formData.get("mailClass");
  const mailClass = mailClassRaw ? (mailClassRaw as $Enums.MailClass) : undefined;

  await prisma.scheduledCommunication.update({
    where: { id: scheduledCommunicationId },
    data: { subject, body, mailClass },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function approveCommunication(claimId: string, scheduledCommunicationId: string) {
  const session = await requireSession();
  requireRole(session, "ADMIN");
  await assertClaimInOrg(claimId, session.organizationId);
  const sc = await assertCommunicationInOrg(scheduledCommunicationId, session.organizationId);
  if (sc.status !== "DRAFT_PENDING_REVIEW") throw new Error("この項目は承認できません");

  const violations = checkProhibitedExpressions(sc.body ?? "");
  if (violations.length > 0) {
    throw new Error(`禁止表現が含まれているため承認できません: ${violations.join("、")}`);
  }

  await prisma.scheduledCommunication.update({
    where: { id: scheduledCommunicationId },
    data: { status: "APPROVED", approvedByUserId: session.userId, approvedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "STATUS_CHANGE",
      description: "督促文面を承認しました",
      metadata: { scheduledCommunicationId },
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function rejectCommunication(claimId: string, scheduledCommunicationId: string, note: string) {
  const session = await requireSession();
  requireRole(session, "ADMIN");
  await assertClaimInOrg(claimId, session.organizationId);
  await assertCommunicationInOrg(scheduledCommunicationId, session.organizationId);

  await prisma.scheduledCommunication.update({
    where: { id: scheduledCommunicationId },
    data: { status: "REJECTED", errorMessage: note || null },
  });

  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "STATUS_CHANGE",
      description: "督促文面を却下しました",
      metadata: { scheduledCommunicationId, note: note || null },
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function clearComplianceFlag(claimId: string, flagId: string) {
  const session = await requireSession();
  requireRole(session, "ADMIN");
  await assertClaimInOrg(claimId, session.organizationId);

  const flag = await prisma.complianceFlag.update({
    where: { id: flagId },
    data: { clearedAt: new Date(), clearedByUserId: session.userId },
  });

  await prisma.activityLog.create({
    data: {
      claimId,
      userId: session.userId,
      type: "COMPLIANCE_FLAG_CLEARED",
      description: `コンプライアンスフラグ「${COMPLIANCE_FLAG_LABEL[flag.flagType]}」を解除しました`,
      metadata: { flagType: flag.flagType },
    },
  });

  revalidatePath(`/cases/${claimId}`);
}

export async function updateVerificationSettings(claimId: string, formData: FormData) {
  const session = await requireSession();
  const claim = await assertClaimInOrg(claimId, session.organizationId);

  const dateOfBirthRaw = String(formData.get("dateOfBirth") ?? "");
  const secretQuestion = String(formData.get("secretQuestion") ?? "").trim();
  const secretAnswer = String(formData.get("secretAnswer") ?? "").trim();

  await prisma.debtor.update({
    where: { id: claim.debtorId },
    data: {
      dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null,
      secretQuestion: secretQuestion || null,
      secretAnswer: secretAnswer || null,
    },
  });

  revalidatePath(`/cases/${claimId}`);
}
