"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSession, requireRole } from "@/lib/auth/getSession";
import type { $Enums } from "@/generated/prisma/client";

export async function updateAiVoiceSettings(formData: FormData) {
  const session = await requireSession();
  requireRole(session, "ADMIN");

  const data = {
    enabled: formData.get("enabled") === "on",
    telephonyProvider: formData.get("telephonyProvider") as $Enums.VoiceTelephonyProvider,
    speechProvider: formData.get("speechProvider") as $Enums.VoiceSpeechProvider,
    callerName: String(formData.get("callerName") ?? "").trim() || "債権管理部",
    callWindowStartHour: Math.min(23, Math.max(0, Math.round(Number(formData.get("callWindowStartHour") ?? 9)))),
    callWindowEndHour: Math.min(24, Math.max(1, Math.round(Number(formData.get("callWindowEndHour") ?? 20)))),
  };

  await prisma.aiVoiceSettings.upsert({
    where: { organizationId: session.organizationId },
    create: { organizationId: session.organizationId, ...data },
    update: data,
  });

  revalidatePath("/settings/ai-voice");
}
