import { addDays, subDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { jstDayStart } from "@/lib/compliance/contactFrequency";
import type { $Enums } from "@/generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TodoClaimRef {
  id: string;
  debtorName: string;
}

export interface TodoBucket {
  key: string;
  label: string;
  claims: TodoClaimRef[];
}

const CALL_CHANNELS: $Enums.Channel[] = ["PHONE", "AI_VOICE_CALL", "OPERATOR_CALL"];
const OPEN_STATUSES: $Enums.ClaimStatus[] = ["ACTIVE", "IN_NEGOTIATION"];

/**
 * Only these types count as "the last time someone/something contacted or
 * heard from the debtor" for the callback/mail/SMS/staleness buckets below —
 * internal-only events (AI re-scoring, notes, status changes, compliance
 * flag edits) don't count as "attending to" a case in that sense.
 */
const CONTACT_RELEVANT_TYPES: $Enums.ActivityType[] = [
  "COMMUNICATION_SENT",
  "PORTAL_ACCESSED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_REVIEWED",
  "CALL_PLACED",
  "CALL_NO_ANSWER",
  "CALL_CONNECTED_DEBTOR",
  "CALL_CONNECTED_FAMILY",
  "DEBTOR_CALLBACK",
  "PAYMENT_PROMISE_MADE",
  "PAYMENT_PROMISE_BROKEN",
  "PAYMENT_RECEIVED",
  "SMS_DELIVERED",
  "SMS_UNDELIVERED",
  "MAIL_DELIVERED",
  "MAIL_RETURNED",
];

function toRef(claim: { id: string; debtor: { name: string } }): TodoClaimRef {
  return { id: claim.id, debtorName: claim.debtor.name };
}

function dedupe(refs: TodoClaimRef[]): TodoClaimRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/**
 * Derives the staff "today's work" checklist entirely from existing data
 * (Claim/ActivityLog/Payment/ComplianceFlag/PaymentPlanProposal) — no
 * dedicated Task table. Several buckets are necessarily approximations
 * (e.g. "today's payment due" uses originalDueDate since there is no formal
 * installment-schedule model yet — that lands in a later phase).
 */
export async function getTodoItems(organizationId: string, now = new Date()): Promise<TodoBucket[]> {
  const dayStart = jstDayStart(now);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS - 1);

  const [
    todaysCalls,
    dueTodayClaims,
    brokenPromiseLogs,
    pendingProposals,
    recentPayments,
    complaintFlags,
    statuteClaims,
    legalCandidates,
    openClaimsWithLatestLog,
  ] = await Promise.all([
    prisma.scheduledCommunication.findMany({
      where: {
        status: "PENDING",
        channel: { in: CALL_CHANNELS },
        scheduledFor: { gte: dayStart, lte: dayEnd },
        claim: { organizationId },
      },
      include: { claim: { include: { debtor: true } } },
    }),
    prisma.claim.findMany({
      where: { organizationId, status: "ACTIVE", originalDueDate: { gte: dayStart, lte: dayEnd } },
      include: { debtor: true },
    }),
    prisma.activityLog.findMany({
      where: { type: "PAYMENT_PROMISE_BROKEN", createdAt: { gte: subDays(now, 30) }, claim: { organizationId } },
      include: { claim: { include: { debtor: true } } },
      distinct: ["claimId"],
    }),
    prisma.paymentPlanProposal.findMany({
      where: { status: "PENDING_REVIEW", claim: { organizationId } },
      include: { claim: { include: { debtor: true } } },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: subDays(now, 3) }, claim: { organizationId } },
      include: { claim: { include: { debtor: true } } },
      distinct: ["claimId"],
    }),
    prisma.complianceFlag.findMany({
      where: { flagType: "COMPLAINT_IN_PROGRESS", clearedAt: null, claim: { organizationId } },
      include: { claim: { include: { debtor: true } } },
    }),
    prisma.claim.findMany({
      where: { organizationId, statuteLimitationDate: { not: null, gte: now, lte: addDays(now, 90) } },
      include: { debtor: true },
    }),
    prisma.claim.findMany({
      where: {
        organizationId,
        status: "LEGAL_ESCALATION",
        complianceFlags: { none: { flagType: "ATTORNEY_INVOLVED", clearedAt: null } },
      },
      include: { debtor: true },
    }),
    prisma.claim.findMany({
      where: { organizationId, status: { in: OPEN_STATUSES } },
      include: {
        debtor: true,
        activityLogs: {
          where: { type: { in: CONTACT_RELEVANT_TYPES } },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  const callbackClaims = openClaimsWithLatestLog.filter((c) => c.activityLogs[0]?.type === "DEBTOR_CALLBACK");
  const mailReturnedClaims = openClaimsWithLatestLog.filter((c) => c.activityLogs[0]?.type === "MAIL_RETURNED");
  const smsUndeliveredClaims = openClaimsWithLatestLog.filter((c) => c.activityLogs[0]?.type === "SMS_UNDELIVERED");
  const staleClaims = openClaimsWithLatestLog.filter(
    (c) => !c.activityLogs[0] || c.activityLogs[0].createdAt < subDays(now, 14),
  );

  return [
    { key: "todaysCalls", label: "本日の架電予定", claims: dedupe(todaysCalls.map((sc) => toRef(sc.claim))) },
    { key: "dueToday", label: "本日の支払期限", claims: dedupe(dueTodayClaims.map(toRef)) },
    {
      key: "brokenPromise",
      label: "約束不履行案件",
      claims: dedupe(brokenPromiseLogs.map((l) => toRef(l.claim))),
    },
    { key: "callback", label: "折返し依頼案件", claims: dedupe(callbackClaims.map(toRef)) },
    {
      key: "pendingApproval",
      label: "上長承認待ち",
      claims: dedupe(pendingProposals.map((p) => toRef(p.claim))),
    },
    { key: "mailReturned", label: "郵便返送案件", claims: dedupe(mailReturnedClaims.map(toRef)) },
    { key: "smsUndelivered", label: "SMS不達案件", claims: dedupe(smsUndeliveredClaims.map(toRef)) },
    { key: "newPayments", label: "新規入金案件", claims: dedupe(recentPayments.map((p) => toRef(p.claim))) },
    {
      key: "complaints",
      label: "苦情・緊急対応案件",
      claims: dedupe(complaintFlags.map((f) => toRef(f.claim))),
    },
    { key: "statuteApproaching", label: "時効期限接近案件", claims: dedupe(statuteClaims.map(toRef)) },
    { key: "legalCandidates", label: "弁護士移管候補", claims: dedupe(legalCandidates.map(toRef)) },
    { key: "stale", label: "長期間対応されていない案件", claims: dedupe(staleClaims.map(toRef)) },
  ];
}
