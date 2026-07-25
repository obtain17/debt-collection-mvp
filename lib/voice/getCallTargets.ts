import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { findBlockingComplianceFlag } from "@/lib/compliance/rules";
import { checkContactFrequency } from "@/lib/compliance/contactFrequency";
import { getAiVoiceSettings } from "./getAiVoiceSettings";
import { COMPLIANCE_FLAG_LABEL } from "@/lib/format";
import type { $Enums } from "@/generated/prisma/client";

const OPEN_STATUSES: $Enums.ClaimStatus[] = ["ACTIVE", "IN_NEGOTIATION"];
const TARGET_LIST_LIMIT = 100;

export interface CallTargetEntry {
  claimId: string;
  debtorName: string;
  phone: string | null;
  currentBalance: number;
  daysOverdue: number;
  eligible: boolean;
  exclusionReason: string | null;
}

export interface CallTargetsResult {
  settingsEnabled: boolean;
  totalOpenClaims: number;
  targets: CallTargetEntry[];
}

/**
 * Backs the "発信対象・除外対象確認" screen (項目4-2): for each open claim,
 * determines whether an AI voice call would actually go out right now and,
 * if not, why — reusing the exact same rule functions
 * (findBlockingComplianceFlag/checkContactFrequency) that
 * lib/voice/placeAiVoiceCall.ts enforces at call time, so this list can never
 * drift from what actually happens on dispatch.
 */
export async function getCallTargets(organizationId: string): Promise<CallTargetsResult> {
  const settings = await getAiVoiceSettings(organizationId);

  const [totalOpenClaims, claims] = await Promise.all([
    prisma.claim.count({ where: { organizationId, status: { in: OPEN_STATUSES } } }),
    prisma.claim.findMany({
      where: { organizationId, status: { in: OPEN_STATUSES } },
      include: { debtor: true },
      orderBy: { currentBalance: "desc" },
      take: TARGET_LIST_LIMIT,
    }),
  ]);

  const targets: CallTargetEntry[] = [];
  for (const claim of claims) {
    const daysOverdue = Math.max(0, differenceInDays(new Date(), claim.originalDueDate));
    let exclusionReason: string | null = null;

    if (!settings.enabled) {
      exclusionReason = "AI音声自動督促が組織単位で無効です";
    } else if (!claim.debtor.phone) {
      exclusionReason = "電話番号が未登録です";
    } else {
      const blockingFlag = await findBlockingComplianceFlag(claim.id, "AI_VOICE_CALL");
      if (blockingFlag) {
        exclusionReason = `コンプライアンスフラグ: ${COMPLIANCE_FLAG_LABEL[blockingFlag.flagType]}`;
      } else {
        const frequencyViolation = await checkContactFrequency(claim.id, "AI_VOICE_CALL");
        if (frequencyViolation) exclusionReason = frequencyViolation;
      }
    }

    targets.push({
      claimId: claim.id,
      debtorName: claim.debtor.name,
      phone: claim.debtor.phone,
      currentBalance: claim.currentBalance,
      daysOverdue,
      eligible: exclusionReason === null,
      exclusionReason,
    });
  }

  return { settingsEnabled: settings.enabled, totalOpenClaims, targets };
}
