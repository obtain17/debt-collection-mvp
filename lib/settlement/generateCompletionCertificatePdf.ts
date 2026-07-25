import { rgb } from "pdf-lib";
import { createJapaneseDoc } from "@/lib/pdf/createJapaneseDoc";
import { formatDate, formatYen } from "@/lib/format";

export interface CompletionCertificatePdfInput {
  claim: { claimType: string; principalAmount: number };
  debtor: { name: string };
  organization: { name: string };
  settledAt: Date;
}

export async function generateCompletionCertificatePdf(
  input: CompletionCertificatePdfInput,
): Promise<Uint8Array> {
  const { doc, font } = await createJapaneseDoc();
  const page = doc.addPage([595, 842]);
  let y = 800;

  const draw = (text: string, size = 12) => {
    page.drawText(text, { x: 50, y, size, font, color: rgb(0, 0, 0) });
    y -= size + 8;
  };

  draw("完済証明書", 20);
  y -= 10;
  draw(input.organization.name);
  draw(`債務者: ${input.debtor.name} 様`);
  draw(`債権種別: ${input.claim.claimType}`);
  draw(`元本: ${formatYen(input.claim.principalAmount)}`);
  draw(`完済日: ${formatDate(input.settledAt)}`);
  y -= 10;
  draw("上記債務につきまして、全額のご返済を確認いたしましたので、ここに証明いたします。");
  y -= 10;
  draw(`発行日: ${formatDate(new Date())}`);

  return doc.save();
}
