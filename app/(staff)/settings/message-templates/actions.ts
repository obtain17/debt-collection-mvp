"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import type { $Enums } from "@/generated/prisma/client";

export async function createMessageTemplate(formData: FormData) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const tone = formData.get("tone") as $Enums.Tone;
  const subjectTemplate = String(formData.get("subjectTemplate") ?? "");
  const bodyTemplate = String(formData.get("bodyTemplate") ?? "");
  if (!key || !label || !subjectTemplate || !bodyTemplate) {
    throw new Error("すべての項目を入力してください");
  }

  await prisma.messageTemplate.create({
    data: {
      organizationId: session.organizationId,
      key,
      label,
      tone,
      subjectTemplate,
      bodyTemplate,
      createdByUserId: session.userId,
    },
  });

  revalidatePath("/settings/message-templates");
}

export async function toggleLegalApproved(templateId: string) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId: session.organizationId },
  });
  if (!template) throw new Error("テンプレートが見つかりません");

  await prisma.messageTemplate.update({
    where: { id: templateId },
    data: { legalApproved: !template.legalApproved },
  });

  revalidatePath("/settings/message-templates");
}

export async function deleteMessageTemplate(templateId: string) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId: session.organizationId },
  });
  if (!template) throw new Error("テンプレートが見つかりません");

  await prisma.messageTemplate.delete({ where: { id: templateId } });

  revalidatePath("/settings/message-templates");
}
