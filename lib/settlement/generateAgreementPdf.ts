import { rgb } from "pdf-lib";
import { createJapaneseDoc } from "@/lib/pdf/createJapaneseDoc";
import { formatDate, formatDateTime, formatYen } from "@/lib/format";

export interface AgreementPdfInput {
  proposal: {
    totalAmount: number;
    installments: unknown;
    settlementOffer: boolean;
    reviewedAt: Date | null;
    debtorConsentedAt: Date | null;
    debtorConsentName: string | null;
  };
  claim: { claimType: string };
  debtor: { name: string };
  organization: { name: string };
  staffApproverName: string | null;
}

export async function generateAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const { doc, font } = await createJapaneseDoc();
  const page = doc.addPage([595, 842]);
  let y = 800;

  const draw = (text: string, size = 12) => {
    page.drawText(text, { x: 50, y, size, font, color: rgb(0, 0, 0) });
    y -= size + 8;
  };

  draw("返済合意書", 20);
  y -= 10;
  draw(input.organization.name);
  draw(`債務者: ${input.debtor.name} 様`);
  draw(`債権種別: ${input.claim.claimType}`);
  y -= 10;
  draw(input.proposal.settlementOffer ? "合意内容: 一括和解" : "合意内容: 分割払い");
  draw(`合意総額: ${formatYen(input.proposal.totalAmount)}`);
  y -= 10;

  draw("支払スケジュール:", 13);
  const installments = Array.isArray(input.proposal.installments)
    ? (input.proposal.installments as Array<{ month: number; amount: number }>)
    : [];
  for (const item of installments) {
    draw(`  第${item.month}回: ${formatYen(item.amount)}`);
  }
  y -= 10;

  draw(`担当者承認者: ${input.staffApproverName ?? "-"}`);
  draw(`担当者承認日時: ${input.proposal.reviewedAt ? formatDateTime(input.proposal.reviewedAt) : "-"}`);
  draw(`債務者電子同意者: ${input.proposal.debtorConsentName ?? "-"}`);
  draw(`債務者電子同意日時: ${input.proposal.debtorConsentedAt ? formatDateTime(input.proposal.debtorConsentedAt) : "-"}`);
  y -= 10;
  draw(`作成日: ${formatDate(new Date())}`);

  return doc.save();
}
