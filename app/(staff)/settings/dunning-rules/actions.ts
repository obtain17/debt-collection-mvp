"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import type { $Enums } from "@/generated/prisma/client";

async function getDefaultRule(organizationId: string) {
  const rule = await prisma.dunningRule.findFirst({ where: { organizationId, isDefault: true } });
  if (!rule) throw new Error("デフォルトの督促ルールが見つかりません");
  return rule;
}

export async function addDunningStep(formData: FormData) {
  const session = await requireSession();
  requireRole(session, "ADMIN");
  const rule = await getDefaultRule(session.organizationId);

  const dayOffset = Math.max(0, Math.round(Number(formData.get("dayOffset") ?? 0)));
  const channel = formData.get("channel") as $Enums.Channel;
  const tone = formData.get("tone") as $Enums.Tone;
  const templateKey = String(formData.get("templateKey") ?? "FRIENDLY_REMINDER");
  const order = Math.max(1, Math.round(Number(formData.get("order") ?? 1)));

  await prisma.dunningStep.create({
    data: { dunningRuleId: rule.id, dayOffset, channel, tone, templateKey, order },
  });

  revalidatePath("/settings/dunning-rules");
}

export async function removeDunningStep(stepId: string) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const step = await prisma.dunningStep.findFirst({
    where: { id: stepId, dunningRule: { organizationId: session.organizationId } },
  });
  if (!step) throw new Error("ステップが見つかりません");

  await prisma.dunningStep.delete({ where: { id: stepId } });

  revalidatePath("/settings/dunning-rules");
}
