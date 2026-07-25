import { prisma } from "@/lib/db/prisma";
import { findBlockingComplianceFlag } from "@/lib/compliance/rules";
import { checkContactFrequency } from "@/lib/compliance/contactFrequency";
import { getAiVoiceSettings } from "./getAiVoiceSettings";
import { isAiConfigured, getAiModel } from "@/lib/ai/client";
import { simulateVoiceCall } from "@/lib/ai/simulateVoiceCall";
import { COMPLIANCE_FLAG_LABEL, formatDate, formatYen } from "@/lib/format";
import type { $Enums, Claim, Debtor, Organization } from "@/generated/prisma/client";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstHour(date: Date): number {
  return new Date(date.getTime() + JST_OFFSET_MS).getUTCHours();
}

export interface PlaceAiVoiceCallInput {
  claimId: string;
  /**
   * Present only when the worker is processing an existing PENDING/APPROVED
   * ScheduledCommunication row found by its 1-minute poll. Omitted for the
   * case-page "今すぐ架電" demo action — that path creates its own
   * ScheduledCommunication row internally, already in a terminal status
   * (never PENDING), so it can never be picked up again by the worker's poll
   * racing against this same synchronous call.
   */
  scheduledCommunicationId?: string;
  actingUserId?: string;
}

export interface PlaceAiVoiceCallResult {
  skipped: boolean;
  reason?: string;
  callLogId?: string;
}

type ClaimForCall = Claim & { debtor: Debtor; organization: Organization };

const OUTCOME_ACTIVITY: Record<$Enums.AiVoiceCallOutcome, { type: $Enums.ActivityType; description: string }> = {
  NO_ANSWER: { type: "CALL_NO_ANSWER", description: "AI音声通話: 応答がありませんでした" },
  VOICEMAIL_LEFT: {
    type: "CALL_VOICEMAIL_LEFT",
    description: "AI音声通話: 留守番電話に折り返し依頼のみ残しました(債権内容は開示していません)",
  },
  CONNECTED_OTHER: {
    type: "CALL_CONNECTED_FAMILY",
    description: "AI音声通話: ご本人以外が応答したため、債権内容は開示していません",
  },
  CONNECTED_DEBTOR: { type: "CALL_CONNECTED_DEBTOR", description: "AI音声通話: 本人と通話しました" },
};

function pickOutcome(): $Enums.AiVoiceCallOutcome {
  const r = Math.random();
  if (r < 0.15) return "NO_ANSWER";
  if (r < 0.3) return "VOICEMAIL_LEFT";
  if (r < 0.4) return "CONNECTED_OTHER";
  return "CONNECTED_DEBTOR";
}

/**
 * The single entrypoint for "placing" a simulated AI voice call. Used both by
 * the dunning worker (a due AI_VOICE_CALL ScheduledCommunication) and by the
 * case detail page's ad-hoc "今すぐ架電" demo button (scheduledCommunicationId
 * omitted). There is no real telephony connection (see README — this MVP has
 * no Twilio/Amazon Connect wiring); lib/ai/simulateVoiceCall.ts only narrates
 * a transcript. All hard compliance rules (channel block, contact frequency,
 * call window, identity gate before disclosure, human handoff on
 * lawyer/bankruptcy/dispute/complaint) are decided and re-checked in this
 * function, not left to the model's judgment.
 */
export async function placeAiVoiceCall(input: PlaceAiVoiceCallInput): Promise<PlaceAiVoiceCallResult> {
  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: input.claimId },
    include: { debtor: true, organization: true },
  });

  const markSkipped = async (reason: string): Promise<PlaceAiVoiceCallResult> => {
    if (input.scheduledCommunicationId) {
      await prisma.scheduledCommunication.update({
        where: { id: input.scheduledCommunicationId },
        data: { status: "SKIPPED", errorMessage: reason },
      });
    } else {
      // Ad-hoc path: record the attempt directly in its terminal state — never
      // as PENDING — so the worker's poll can never race with this call over it.
      await prisma.scheduledCommunication.create({
        data: { claimId: claim.id, channel: "AI_VOICE_CALL", scheduledFor: new Date(), status: "SKIPPED", errorMessage: reason },
      });
    }
    return { skipped: true, reason };
  };

  if (claim.status === "SETTLED" || claim.status === "WRITTEN_OFF") {
    return markSkipped("ケースが完済・償却済みのため実行できません");
  }

  const settings = await getAiVoiceSettings(claim.organizationId);
  if (!settings.enabled) {
    return markSkipped("AI音声自動督促がこの組織で無効になっています(設定画面で有効化してください)");
  }

  if (!claim.debtor.phone) {
    return markSkipped("債務者の電話番号が未登録のため実行できません");
  }

  const blockingFlag = await findBlockingComplianceFlag(claim.id, "AI_VOICE_CALL");
  if (blockingFlag) {
    return markSkipped(`コンプライアンスフラグ「${COMPLIANCE_FLAG_LABEL[blockingFlag.flagType]}」により実行できません`);
  }

  const frequencyViolation = await checkContactFrequency(claim.id, "AI_VOICE_CALL");
  if (frequencyViolation) {
    return markSkipped(frequencyViolation);
  }

  const hour = jstHour(new Date());
  if (hour < settings.callWindowStartHour || hour >= settings.callWindowEndHour) {
    return markSkipped(
      `この組織の発信可能時間帯(${settings.callWindowStartHour}:00〜${settings.callWindowEndHour}:00)外のため実行できません`,
    );
  }

  const outcome = pickOutcome();

  if (outcome !== "CONNECTED_DEBTOR") {
    return finalize(claim, input, { outcome, identityVerified: false });
  }

  // Identity gate is decided here — deterministically, not by the model —
  // because "no disclosure before identity confirmation" is a hard rule.
  const identityVerificationSucceeded =
    claim.debtor.identityVerificationStatus === "VERIFIED" || Math.random() < 0.85;

  if (!isAiConfigured()) {
    return finalize(claim, input, {
      outcome,
      identityVerified: identityVerificationSucceeded,
      transferredToHuman: !identityVerificationSucceeded,
      summary: identityVerificationSucceeded
        ? "(AI未設定のため簡易シミュレーション)本人確認の上、支払期日超過について案内し、専用ページでのご相談をお願いしました。"
        : "(AI未設定のため簡易シミュレーション)本人確認ができなかったため、債権内容は開示せず、担当者からの連絡を案内して終了しました。",
      transcript: [
        { speaker: "AI", text: "お忙しい中恐れ入ります。本人確認のため、ご登録の電話番号下4桁をお願いできますか。" },
        { speaker: "DEBTOR", text: identityVerificationSucceeded ? "はい、わかりました。" : "今は答えられません。" },
      ],
    });
  }

  const result = await simulateVoiceCall({
    today: new Date().toISOString().slice(0, 10),
    organizationName: claim.organization.name,
    callerName: settings.callerName,
    debtorName: claim.debtor.name,
    claimType: claim.claimType,
    currentBalance: claim.currentBalance,
    daysOverdue: Math.max(0, Math.round((Date.now() - claim.originalDueDate.getTime()) / (24 * 60 * 60 * 1000))),
    tone: "NEUTRAL_FIRM",
    identityVerificationSucceeded,
  });

  // Defensive re-check: the model's structured output is never trusted blindly
  // for the fields that gate compliance behavior.
  const detectedComplianceFlag = identityVerificationSucceeded ? result.detectedComplianceTrigger : null;
  const transferredToHuman =
    !identityVerificationSucceeded || Boolean(detectedComplianceFlag) || result.requiresHumanFollowUp;
  const paymentPromiseDate =
    identityVerificationSucceeded && result.paymentPromiseDate ? new Date(result.paymentPromiseDate) : null;
  const paymentPromiseAmount = identityVerificationSucceeded ? result.paymentPromiseAmount : null;

  return finalize(claim, input, {
    outcome,
    identityVerified: identityVerificationSucceeded,
    transcript: result.transcript,
    summary: result.summary,
    detectedComplianceFlag,
    transferredToHuman,
    paymentPromiseDate,
    paymentPromiseAmount,
    modelUsed: getAiModel(),
  });
}

async function finalize(
  claim: ClaimForCall,
  input: PlaceAiVoiceCallInput,
  data: {
    outcome: $Enums.AiVoiceCallOutcome;
    identityVerified: boolean;
    transcript?: unknown;
    summary?: string;
    detectedComplianceFlag?: $Enums.ComplianceFlagType | null;
    transferredToHuman?: boolean;
    paymentPromiseDate?: Date | null;
    paymentPromiseAmount?: number | null;
    modelUsed?: string;
  },
): Promise<PlaceAiVoiceCallResult> {
  // Claim (update) or create the ScheduledCommunication row in its terminal
  // state before creating the call log, so AiVoiceCallLog.scheduledCommunicationId
  // always points at a row that is never PENDING/APPROVED — see the comment
  // on PlaceAiVoiceCallInput.scheduledCommunicationId for why.
  let scheduledCommunicationId = input.scheduledCommunicationId;
  if (scheduledCommunicationId) {
    await prisma.scheduledCommunication.update({
      where: { id: scheduledCommunicationId },
      data: { status: "SENT", sentAt: new Date() },
    });
  } else {
    const sc = await prisma.scheduledCommunication.create({
      data: { claimId: claim.id, channel: "AI_VOICE_CALL", scheduledFor: new Date(), status: "SENT", sentAt: new Date() },
    });
    scheduledCommunicationId = sc.id;
  }

  const callLog = await prisma.aiVoiceCallLog.create({
    data: {
      claimId: claim.id,
      scheduledCommunicationId,
      outcome: data.outcome,
      identityVerified: data.identityVerified,
      transcript: data.transcript as never,
      summary: data.summary,
      detectedComplianceFlag: data.detectedComplianceFlag ?? undefined,
      transferredToHuman: data.transferredToHuman ?? false,
      paymentPromiseDate: data.paymentPromiseDate ?? undefined,
      paymentPromiseAmount: data.paymentPromiseAmount ?? undefined,
      modelUsed: data.modelUsed,
    },
  });

  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      userId: input.actingUserId,
      type: "CALL_PLACED",
      description: "AI音声通話を発信しました",
      metadata: { voiceCallLogId: callLog.id },
    },
  });

  const outcomeInfo = OUTCOME_ACTIVITY[data.outcome];
  await prisma.activityLog.create({
    data: {
      claimId: claim.id,
      userId: input.actingUserId,
      type: outcomeInfo.type,
      description:
        data.outcome === "CONNECTED_DEBTOR" && data.summary
          ? `${outcomeInfo.description}(${data.summary})`
          : outcomeInfo.description,
      metadata: { voiceCallLogId: callLog.id },
    },
  });

  if (data.detectedComplianceFlag) {
    await prisma.complianceFlag.create({
      data: { claimId: claim.id, flagType: data.detectedComplianceFlag, reason: "AI音声通話中に検知" },
    });
    await prisma.activityLog.create({
      data: {
        claimId: claim.id,
        type: "COMPLIANCE_FLAG_SET",
        description: `コンプライアンスフラグ「${COMPLIANCE_FLAG_LABEL[data.detectedComplianceFlag]}」を設定しました(AI音声通話中に検知・自動停止)`,
        metadata: { voiceCallLogId: callLog.id, flagType: data.detectedComplianceFlag },
      },
    });
  }

  if (data.paymentPromiseDate && data.paymentPromiseAmount) {
    await prisma.activityLog.create({
      data: {
        claimId: claim.id,
        type: "PAYMENT_PROMISE_MADE",
        description: `AI音声通話で支払約束を確認しました(${formatDate(data.paymentPromiseDate)} / ${formatYen(data.paymentPromiseAmount)})`,
        metadata: { voiceCallLogId: callLog.id },
      },
    });
  }

  return { skipped: false, callLogId: callLog.id };
}
