import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, getAiModel } from "./client";

const ExtractedDepositsSchema = z.object({
  deposits: z.array(
    z.object({
      date: z.string().describe("ISO 8601 date (YYYY-MM-DD), best guess if the year is not printed"),
      amount: z.number().int().positive(),
      payerName: z.string().describe("振込人名義。判読できない場合は「不明」"),
    }),
  ),
});

export type ExtractedDeposit = z.infer<typeof ExtractedDepositsSchema>["deposits"][number];

const SYSTEM_PROMPT = `あなたは日本の金融機関の通帳・銀行明細の画像を読み取り、入金(お金が振り込まれた)記録だけを
構造化データとして抽出するアシスタントです。
- 出金・引き落としの行は含めないでください。
- 日付・金額・振込人名義が読み取れる行だけを抽出してください。
- 金額は円単位の整数にしてください(カンマや円マークは除去)。
- 振込人名義が読み取れない場合は「不明」としてください。
- 画像に無い情報を創作しないでください。`;

/**
 * Extracts deposit rows (date/amount/payer name) from a photo or screenshot
 * of a bank statement / passbook, using the existing Anthropic vision model —
 * no dedicated OCR dependency needed.
 */
export async function extractDepositsFromImage(imageBase64: string, mediaType: string): Promise<ExtractedDeposit[]> {
  const client = getAnthropicClient();

  const message = await client.messages.parse({
    model: getAiModel(),
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/png" | "image/jpeg", data: imageBase64 },
          },
          { type: "text", text: "この画像から入金行のみを抽出してください。" },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(ExtractedDepositsSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("画像の解析に失敗しました");
  }

  return message.parsed_output.deposits;
}
