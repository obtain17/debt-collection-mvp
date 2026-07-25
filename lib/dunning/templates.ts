import type { $Enums } from "@/generated/prisma/client";
import { formatDate, formatYen } from "@/lib/format";

export interface TemplateContext {
  organizationName: string;
  debtorName: string;
  claimType: string;
  currentBalance: number;
  originalDueDate: Date;
  daysOverdue: number;
  portalUrl: string;
}

export interface RenderedTemplate {
  subject: string;
  body: string;
}

/**
 * Renders dunning content. The organization (client) is always presented as
 * the counterparty requesting payment — never this platform — in line with
 * the Servicer Law framing: this system is tooling the client's own staff
 * use, not a collection agent acting on their behalf.
 */
export function renderTemplate(
  templateKey: string,
  channel: $Enums.Channel,
  ctx: TemplateContext,
): RenderedTemplate {
  switch (templateKey) {
    case "FIRM_NOTICE":
      return firmNotice(ctx, channel);
    case "FINAL_NOTICE":
      return finalNotice(ctx, channel);
    case "FRIENDLY_REMINDER":
    default:
      return friendlyReminder(ctx, channel);
  }
}

function friendlyReminder(ctx: TemplateContext, channel: $Enums.Channel): RenderedTemplate {
  const subject = `【${ctx.organizationName}】お支払いのご案内`;
  if (channel === "SMS") {
    return {
      subject,
      body: `【${ctx.organizationName}】${ctx.debtorName}様、${ctx.claimType}のお支払い期日(${formatDate(ctx.originalDueDate)})が経過しております。ご確認をお願いいたします。詳細・お手続き: ${ctx.portalUrl}`,
    };
  }
  return {
    subject,
    body: [
      `${ctx.debtorName} 様`,
      "",
      `平素より大変お世話になっております。${ctx.organizationName}でございます。`,
      `${ctx.claimType}(お支払期日: ${formatDate(ctx.originalDueDate)})につきまして、現時点でご入金が確認できておりません。`,
      `現在の残高は ${formatYen(ctx.currentBalance)} です。`,
      "",
      "行き違いでのご入金の場合は本メールをご容赦ください。",
      "お支払い状況のご確認やご相談は、以下の専用ページからお願いいたします。",
      ctx.portalUrl,
      "",
      `${ctx.organizationName} 債権管理部`,
    ].join("\n"),
  };
}

function firmNotice(ctx: TemplateContext, channel: $Enums.Channel): RenderedTemplate {
  const subject = `【重要】${ctx.organizationName}よりお支払いのお願い(督促)`;
  if (channel === "SMS") {
    return {
      subject,
      body: `【重要】${ctx.organizationName}: ${ctx.debtorName}様、${ctx.claimType}のお支払いが${ctx.daysOverdue}日超過しております(残高${formatYen(ctx.currentBalance)})。至急ご確認ください: ${ctx.portalUrl}`,
    };
  }
  return {
    subject,
    body: [
      `${ctx.debtorName} 様`,
      "",
      `${ctx.organizationName}でございます。`,
      `${ctx.claimType}につきまして、お支払期日(${formatDate(ctx.originalDueDate)})より${ctx.daysOverdue}日が経過しておりますが、現時点でご入金が確認できておりません。`,
      `現在の残高は ${formatYen(ctx.currentBalance)} です。`,
      "",
      "既にご事情がある場合は、下記の専用ページより分割払い等のご相談が可能です。",
      "お早めのご対応をお願いいたします。",
      ctx.portalUrl,
      "",
      `${ctx.organizationName} 債権管理部`,
    ].join("\n"),
  };
}

function finalNotice(ctx: TemplateContext, channel: $Enums.Channel): RenderedTemplate {
  const subject = `【最終通告】${ctx.organizationName}よりお支払いについて`;
  if (channel === "LETTER") {
    return {
      subject,
      body: [
        "最終通告書",
        "",
        `${ctx.debtorName} 様`,
        "",
        `${ctx.organizationName}`,
        "",
        `${ctx.claimType}につきまして、お支払期日(${formatDate(ctx.originalDueDate)})より${ctx.daysOverdue}日が経過してもご入金が確認できておりません。`,
        `現在の残高は ${formatYen(ctx.currentBalance)} です。`,
        "",
        "本書面到達後、速やかにお支払いいただけない場合、法的手続き等の措置を検討せざるを得ない状況です。",
        "お支払いまたはご相談については、以下の専用ページよりお手続きください。",
        ctx.portalUrl,
        "",
        `${ctx.organizationName} 債権管理部`,
      ].join("\n"),
    };
  }
  return {
    subject,
    body: [
      `${ctx.debtorName} 様`,
      "",
      `${ctx.organizationName}でございます。`,
      `${ctx.claimType}につきまして、お支払期日(${formatDate(ctx.originalDueDate)})より${ctx.daysOverdue}日が経過してもご入金が確認できておりません。`,
      `現在の残高は ${formatYen(ctx.currentBalance)} です。`,
      "",
      "本メール到達後、速やかにお支払いいただけない場合、法的手続き等の措置を検討せざるを得ない状況です。",
      "お支払いまたはご相談については、以下の専用ページよりお手続きください。",
      ctx.portalUrl,
      "",
      `${ctx.organizationName} 債権管理部`,
    ].join("\n"),
  };
}
