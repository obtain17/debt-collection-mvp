import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { renderTemplate, type RenderedTemplate, type TemplateContext } from "./templates";
import { ensureAccessToken, buildPortalUrl } from "@/lib/portal/ensureAccessToken";
import { formatDate, formatYen } from "@/lib/format";
import type { $Enums } from "@/generated/prisma/client";

export interface ClaimForRendering {
  id: string;
  organizationId: string;
  claimType: string;
  currentBalance: number;
  originalDueDate: Date;
  debtor: { name: string };
  organization: { name: string };
}

/** FIRM_NOTICE/FINAL_NOTICE and any LETTER send require staff review before dispatch. */
export function needsApprovalGate(channel: $Enums.Channel, templateKey: string): boolean {
  return channel === "LETTER" || templateKey === "FIRM_NOTICE" || templateKey === "FINAL_NOTICE";
}

function substitutePlaceholders(text: string, ctx: TemplateContext): string {
  return text
    .replaceAll("{{organizationName}}", ctx.organizationName)
    .replaceAll("{{debtorName}}", ctx.debtorName)
    .replaceAll("{{claimType}}", ctx.claimType)
    .replaceAll("{{currentBalance}}", formatYen(ctx.currentBalance))
    .replaceAll("{{originalDueDate}}", formatDate(ctx.originalDueDate))
    .replaceAll("{{daysOverdue}}", String(ctx.daysOverdue))
    .replaceAll("{{portalUrl}}", ctx.portalUrl);
}

/**
 * The single entrypoint for rendering dunning content. Prefers an
 * organization-authored MessageTemplate matching the given key; falls back
 * to the built-in hardcoded templates (lib/dunning/templates.ts) otherwise.
 */
export async function renderDunningContent(
  claim: ClaimForRendering,
  channel: $Enums.Channel,
  templateKey: string,
): Promise<RenderedTemplate> {
  const token = await ensureAccessToken(claim.id);
  const ctx: TemplateContext = {
    organizationName: claim.organization.name,
    debtorName: claim.debtor.name,
    claimType: claim.claimType,
    currentBalance: claim.currentBalance,
    originalDueDate: claim.originalDueDate,
    daysOverdue: Math.max(0, differenceInDays(new Date(), claim.originalDueDate)),
    portalUrl: buildPortalUrl(token),
  };

  const custom = await prisma.messageTemplate.findUnique({
    where: { organizationId_key: { organizationId: claim.organizationId, key: templateKey } },
  });

  if (custom) {
    return {
      subject: substitutePlaceholders(custom.subjectTemplate, ctx),
      body: substitutePlaceholders(custom.bodyTemplate, ctx),
    };
  }

  return renderTemplate(templateKey, channel, ctx);
}

/** Built-in template keys are treated as already legal-reviewed for this MVP. */
export const BUILTIN_TEMPLATE_KEYS = ["FRIENDLY_REMINDER", "FIRM_NOTICE", "FINAL_NOTICE"];

export async function isTemplateLegalApproved(organizationId: string, templateKey: string): Promise<boolean> {
  if (BUILTIN_TEMPLATE_KEYS.includes(templateKey)) return true;
  const custom = await prisma.messageTemplate.findUnique({
    where: { organizationId_key: { organizationId, key: templateKey } },
  });
  return custom?.legalApproved ?? false;
}
