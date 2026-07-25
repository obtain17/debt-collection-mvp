import { addMonths, setDate } from "date-fns";
import { prisma } from "@/lib/db/prisma";

/**
 * Materializes a concrete due-date schedule from an agreed proposal's
 * installments JSON, run once when the debtor gives electronic consent.
 */
export async function generateScheduleFromProposal(
  claimId: string,
  proposal: {
    installments: unknown;
    firstPaymentDate: Date | null;
    desiredPaymentDay: number | null;
  },
): Promise<void> {
  const installments = Array.isArray(proposal.installments)
    ? (proposal.installments as Array<{ month: number; amount: number }>)
    : [];
  if (installments.length === 0) return;

  const baseDate = proposal.firstPaymentDate ?? new Date();

  for (const item of installments) {
    let dueDate = addMonths(baseDate, item.month - 1);
    if (proposal.desiredPaymentDay) {
      dueDate = setDate(dueDate, Math.min(28, proposal.desiredPaymentDay));
    }
    await prisma.paymentScheduleItem.create({
      data: { claimId, dueDate, amount: item.amount, status: "PENDING" },
    });
  }
}
