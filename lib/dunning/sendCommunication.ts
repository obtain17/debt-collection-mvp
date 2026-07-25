import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/prisma";
import { renderDunningContent } from "./renderContent";
import { CHANNEL_LABEL, COMPLIANCE_FLAG_LABEL } from "@/lib/format";
import { findBlockingComplianceFlag } from "@/lib/compliance/rules";
import { checkContactFrequency } from "@/lib/compliance/contactFrequency";
import { placeAiVoiceCall } from "@/lib/voice/placeAiVoiceCall";
import type { $Enums } from "@/generated/prisma/client";

let transporter: nodemailer.Transporter | undefined;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "localhost",
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false,
    });
  }
  return transporter;
}

const INACTIVE_STATUSES = new Set(["SETTLED", "WRITTEN_OFF"]);

async function findDueCommunications() {
  return prisma.scheduledCommunication.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] }, scheduledFor: { lte: new Date() } },
    include: {
      claim: { include: { debtor: true, organization: true } },
      dunningStep: true,
    },
    take: 50,
    orderBy: { scheduledFor: "asc" },
  });
}

type DueCommunication = Awaited<ReturnType<typeof findDueCommunications>>[number];

/**
 * Picks up all due, still-pending scheduled communications and processes
 * each one: renders the template, "sends" it (real SMTP for email,
 * simulated/logged for SMS/letter/phone), and records the outcome. Called by
 * the worker's cron tick; also safe to call ad hoc (e.g. in tests).
 */
export async function sendDueCommunications(): Promise<number> {
  const due = await findDueCommunications();

  let processed = 0;
  for (const sc of due) {
    try {
      await processOne(sc);
      processed += 1;
    } catch (error) {
      await prisma.scheduledCommunication.update({
        where: { id: sc.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  return processed;
}

async function processOne(sc: DueCommunication): Promise<void> {
  const { claim } = sc;

  if (INACTIVE_STATUSES.has(claim.status)) {
    await prisma.scheduledCommunication.update({ where: { id: sc.id }, data: { status: "SKIPPED" } });
    return;
  }

  // AI_VOICE_CALL has its own dedicated pipeline (compliance checks, identity
  // gate, transcript simulation, call log) — it doesn't use the
  // template-rendering path below, which only makes sense for text channels.
  if (sc.channel === "AI_VOICE_CALL") {
    await placeAiVoiceCall({ claimId: claim.id, scheduledCommunicationId: sc.id });
    return;
  }

  const blockingFlag = await findBlockingComplianceFlag(claim.id, sc.channel);
  if (blockingFlag) {
    await prisma.scheduledCommunication.update({
      where: { id: sc.id },
      data: {
        status: "SKIPPED",
        errorMessage: `コンプライアンスフラグ「${COMPLIANCE_FLAG_LABEL[blockingFlag.flagType]}」により自動送信を停止しています`,
      },
    });
    return;
  }

  const frequencyViolation = await checkContactFrequency(claim.id, sc.channel);
  if (frequencyViolation) {
    await prisma.scheduledCommunication.update({
      where: { id: sc.id },
      data: { status: "SKIPPED", errorMessage: frequencyViolation },
    });
    return;
  }

  const templateKey = sc.dunningStep?.templateKey ?? "FRIENDLY_REMINDER";

  // APPROVED items were already rendered (and possibly staff-edited) when they
  // entered the review queue; re-rendering here would discard those edits.
  const rendered =
    sc.status === "APPROVED" && sc.subject && sc.body
      ? { subject: sc.subject, body: sc.body }
      : await renderDunningContent(claim, sc.channel, templateKey);

  if (sc.channel === "EMAIL") {
    if (!claim.debtor.email) {
      await prisma.scheduledCommunication.update({
        where: { id: sc.id },
        data: { status: "SKIPPED", errorMessage: "債務者のメールアドレスが未登録です" },
      });
      return;
    }
    await getTransporter().sendMail({
      from: `"${claim.organization.name}" <no-reply@example.com>`,
      to: claim.debtor.email,
      subject: rendered.subject,
      text: rendered.body,
    });
  }
  // SMS / PHONE / LETTER are simulated for this MVP: recorded below, not actually dispatched.

  await prisma.scheduledCommunication.update({
    where: { id: sc.id },
    data: { status: "SENT", sentAt: new Date(), subject: rendered.subject, body: rendered.body },
  });

  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      type: "COMMUNICATION_SENT",
      description: `${CHANNEL_LABEL[sc.channel]}で督促(${templateKey})を送信しました`,
      metadata: { channel: sc.channel, scheduledCommunicationId: sc.id },
    },
  });

  await simulateDeliveryOutcome(claim.id, sc.channel, sc.id);
}

/**
 * SMS/letter have no real gateway in this MVP, so a delivery outcome is
 * simulated (weighted toward success) and logged as its own timeline entry,
 * distinct from the "sent" entry above.
 */
async function simulateDeliveryOutcome(
  claimId: string,
  channel: $Enums.Channel,
  scheduledCommunicationId: string,
): Promise<void> {
  if (channel !== "SMS" && channel !== "LETTER") return;

  const delivered = Math.random() < 0.85;
  const type: $Enums.ActivityType =
    channel === "SMS" ? (delivered ? "SMS_DELIVERED" : "SMS_UNDELIVERED") : delivered ? "MAIL_DELIVERED" : "MAIL_RETURNED";
  const description =
    channel === "SMS"
      ? delivered
        ? "SMSが到達しました"
        : "SMSが不達でした"
      : delivered
        ? "郵便が配達されました"
        : "郵便が返送されました";

  await prisma.activityLog.create({
    data: { claimId, type, description, metadata: { scheduledCommunicationId } },
  });
}
