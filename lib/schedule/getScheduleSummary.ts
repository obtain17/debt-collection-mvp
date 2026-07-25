import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";

export interface ScheduleSummary {
  thisMonthDue: number;
  thisMonthPaid: number;
  unpaidAmount: number;
  nextDueDate: Date | null;
  daysOverdue: number;
  fulfillmentRate: number | null;
  consecutivePayments: number;
  missedCount: number;
  payoffDate: Date | null;
}

/**
 * PaymentScheduleItem.status never gets flipped to OVERDUE by a background
 * job (there's no scheduler hook for it in this MVP), so "overdue"/"missed"
 * are derived here at read time by comparing dueDate/paidAt against now,
 * rather than trusting a stored status transition that never happens.
 */
export async function getScheduleSummary(claimId: string, now = new Date()): Promise<ScheduleSummary | null> {
  const items = await prisma.paymentScheduleItem.findMany({
    where: { claimId },
    orderBy: { dueDate: "asc" },
  });
  if (items.length === 0) return null;

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonthItems = items.filter((i) => i.dueDate >= monthStart && i.dueDate <= monthEnd);
  const thisMonthDue = thisMonthItems.reduce((sum, i) => sum + i.amount, 0);
  const thisMonthPaid = thisMonthItems
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.amount, 0);

  const unpaidItems = items.filter((i) => i.status === "PENDING" || i.status === "OVERDUE");
  const unpaidAmount = unpaidItems.reduce((sum, i) => sum + i.amount, 0);

  const nextItem = unpaidItems[0] ?? null;
  const nextDueDate = nextItem?.dueDate ?? null;
  const daysOverdue = nextDueDate && nextDueDate < now ? differenceInDays(now, nextDueDate) : 0;

  const elapsedItems = items.filter((i) => i.dueDate <= now);
  const fulfillmentRate =
    elapsedItems.length > 0 ? elapsedItems.filter((i) => i.status === "PAID").length / elapsedItems.length : null;

  let consecutivePayments = 0;
  for (let i = elapsedItems.length - 1; i >= 0; i--) {
    if (elapsedItems[i].status === "PAID") consecutivePayments++;
    else break;
  }

  const missedCount = items.filter((i) => {
    if (i.status === "PAID") return i.paidAt != null && i.paidAt > i.dueDate;
    return i.status === "PENDING" && i.dueDate < now;
  }).length;

  const payoffDate = items[items.length - 1]?.dueDate ?? null;

  return {
    thisMonthDue,
    thisMonthPaid,
    unpaidAmount,
    nextDueDate,
    daysOverdue,
    fulfillmentRate,
    consecutivePayments,
    missedCount,
    payoffDate,
  };
}
