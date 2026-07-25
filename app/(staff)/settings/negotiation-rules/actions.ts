"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireRole } from "@/lib/auth/getSession";

export async function updateNegotiationRule(formData: FormData) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const data = {
    allowPrincipalReduction: formData.get("allowPrincipalReduction") === "on",
    allowInterestWaiver: formData.get("allowInterestWaiver") === "on",
    allowLateDamageWaiver: formData.get("allowLateDamageWaiver") === "on",
    maxDiscountRate: Number(formData.get("maxDiscountRate") ?? 0) / 100,
    maxInstallments: Math.round(Number(formData.get("maxInstallments") ?? 0)),
    minMonthlyAmount: Math.round(Number(formData.get("minMonthlyAmount") ?? 0)),
    firstPaymentDeadlineDays: Math.round(Number(formData.get("firstPaymentDeadlineDays") ?? 0)),
    noApprovalMaxDiscountRate: Number(formData.get("noApprovalMaxDiscountRate") ?? 0) / 100,
    supervisorApprovalMaxDiscountRate: Number(formData.get("supervisorApprovalMaxDiscountRate") ?? 0) / 100,
  };

  await prisma.negotiationRule.upsert({
    where: { organizationId: session.organizationId },
    create: { organizationId: session.organizationId, ...data },
    update: data,
  });

  revalidatePath("/settings/negotiation-rules");
}
