import { prisma } from "@/lib/db/prisma";
import type { AiVoiceSettings } from "@/generated/prisma/client";

const DEFAULT_SETTINGS: Omit<AiVoiceSettings, "id" | "organizationId" | "updatedAt"> = {
  enabled: false,
  telephonyProvider: "TWILIO",
  speechProvider: "OPENAI_REALTIME",
  callerName: "債権管理部",
  callWindowStartHour: 9,
  callWindowEndHour: 20,
};

/**
 * Returns the organization's AI voice-calling configuration, falling back to
 * sensible (disabled) defaults when no row has been configured yet — mirrors
 * lib/negotiation/getNegotiationRule.ts.
 */
export async function getAiVoiceSettings(
  organizationId: string,
): Promise<Omit<AiVoiceSettings, "id" | "organizationId" | "updatedAt">> {
  const settings = await prisma.aiVoiceSettings.findUnique({ where: { organizationId } });
  return settings ?? DEFAULT_SETTINGS;
}
