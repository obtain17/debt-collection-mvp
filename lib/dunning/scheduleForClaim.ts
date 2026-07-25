import { addDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { needsApprovalGate, renderDunningContent } from "./renderContent";

/**
 * Materializes concrete ScheduledCommunication rows for a claim by applying
 * its organization's default DunningRule against the claim's due date.
 * Low-risk steps (friendly reminders via email/SMS etc.) keep content
 * unrendered until send time, so it reflects the claim's live balance rather
 * than a stale snapshot. Steps that require staff approval before dispatch
 * (FIRM_NOTICE/FINAL_NOTICE, or any LETTER) are rendered immediately instead,
 * since the approver needs to review the actual text.
 */
export async function scheduleForClaim(claimId: string): Promise<void> {
  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { debtor: true, organization: true },
  });

  const rule = await prisma.dunningRule.findFirst({
    where: { organizationId: claim.organizationId, isDefault: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!rule) return;

  if (claim.dunningRuleId !== rule.id) {
    await prisma.claim.update({ where: { id: claim.id }, data: { dunningRuleId: rule.id } });
  }

  for (const step of rule.steps) {
    const scheduledFor = addDays(claim.originalDueDate, step.dayOffset);
    const gated = needsApprovalGate(step.channel, step.templateKey);

    const rendered = gated ? await renderDunningContent(claim, step.channel, step.templateKey) : null;

    await prisma.scheduledCommunication.create({
      data: {
        claimId: claim.id,
        dunningStepId: step.id,
        scheduledFor,
        channel: step.channel,
        status: gated ? "DRAFT_PENDING_REVIEW" : "PENDING",
        subject: rendered?.subject,
        body: rendered?.body,
      },
    });
  }
}
