import type { $Enums } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const ALL_COMPLIANCE_FLAG_TYPES: $Enums.ComplianceFlagType[] = [
  "ATTORNEY_INVOLVED",
  "BANKRUPTCY_OR_REHAB",
  "DEBT_DISPUTE",
  "DECEASED",
  "INHERITANCE_PENDING",
  "IDENTITY_UNVERIFIED",
  "COMPLAINT_IN_PROGRESS",
  "MISBILLING_SUSPECTED",
  "STATUTE_REVIEW",
  "PHONE_PROHIBITED",
  "MAIL_PROHIBITED",
  "SMS_PROHIBITED",
  "ALL_AUTOMATION_PROHIBITED",
];

/**
 * Flag types that block every automated channel outright (attorney/legal
 * situations, deceased debtor, active disputes, etc.) rather than just one
 * channel.
 */
export const BLOCKS_ALL_AUTOMATION = new Set<$Enums.ComplianceFlagType>([
  "ATTORNEY_INVOLVED",
  "BANKRUPTCY_OR_REHAB",
  "DEBT_DISPUTE",
  "DECEASED",
  "INHERITANCE_PENDING",
  "IDENTITY_UNVERIFIED",
  "COMPLAINT_IN_PROGRESS",
  "MISBILLING_SUSPECTED",
  "STATUTE_REVIEW",
  "ALL_AUTOMATION_PROHIBITED",
]);

/** Flag types that only block a specific set of channels. */
export const BLOCKS_CHANNEL: Partial<Record<$Enums.ComplianceFlagType, $Enums.Channel[]>> = {
  PHONE_PROHIBITED: ["PHONE", "AI_VOICE_CALL", "OPERATOR_CALL"],
  MAIL_PROHIBITED: ["LETTER"],
  SMS_PROHIBITED: ["SMS"],
};

export function getActiveComplianceFlags(claimId: string) {
  return prisma.complianceFlag.findMany({
    where: { claimId, clearedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns the active flag that blocks sending on the given channel for this
 * claim, or null if nothing blocks it. Used both to gate automated dunning
 * sends and to explain why a send was skipped.
 */
export async function findBlockingComplianceFlag(
  claimId: string,
  channel: $Enums.Channel,
): Promise<{ flagType: $Enums.ComplianceFlagType } | null> {
  const activeFlags = await getActiveComplianceFlags(claimId);
  const blocking = activeFlags.find(
    (flag) => BLOCKS_ALL_AUTOMATION.has(flag.flagType) || (BLOCKS_CHANNEL[flag.flagType]?.includes(channel) ?? false),
  );
  return blocking ? { flagType: blocking.flagType } : null;
}
