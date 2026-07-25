import { prisma } from "@/lib/db/prisma";
import type { $Enums } from "@/generated/prisma/client";

const CANCELLABLE_STATUSES: $Enums.CommunicationStatus[] = ["PENDING", "DRAFT_PENDING_REVIEW", "APPROVED"];

/**
 * Stops all not-yet-sent dunning for a claim (e.g. because a repayment plan
 * was just agreed, or the claim was just paid off in full). Marks each
 * ScheduledCommunication as SKIPPED with the given reason rather than
 * deleting it, so the case timeline/schedule keeps an audit trail.
 */
export async function cancelPendingCommunications(claimId: string, reason: string): Promise<number> {
  const result = await prisma.scheduledCommunication.updateMany({
    where: { claimId, status: { in: CANCELLABLE_STATUSES } },
    data: { status: "SKIPPED", errorMessage: reason },
  });
  return result.count;
}
