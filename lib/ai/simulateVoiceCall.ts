import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, getAiModel } from "./client";
import { VoiceCallSimulationResultSchema, type VoiceCallSimulationResult } from "./schema";

export interface VoiceCallSimulationInput {
  /** ISO date (YYYY-MM-DD) for "today" — the model has no other way to know the current date, so relative promises ("来月10日") would otherwise anchor to its training cutoff instead. */
  today: string;
  organizationName: string;
  callerName: string;
  debtorName: string;
  claimType: string;
  currentBalance: number;
  daysOverdue: number;
  tone: "EMPATHETIC" | "NEUTRAL_FIRM" | "FORMAL_FINAL_NOTICE";
  /** Decided deterministically by lib/voice/placeAiVoiceCall.ts before calling this — the model narrates within it, it does not decide it. */
  identityVerificationSucceeded: boolean;
}

const SYSTEM_PROMPT = `あなたは日本の金融機関・サービサー等が用いるAI自動架電システムの会話シミュレーターです。
実際に電話をかけるわけではなく、「もしこの条件で自動音声架電を行ったら、どのような会話になるか」を
台本(トランスクリプト)として生成し、スタッフ向けの要約を作ることだけが役割です。

絶対に守るべき制約(逸脱した場合、生成結果は使用されません):
- あなたは債権回収を行う主体ではありません。一人称で「回収します」等と宣言しないこと。
- identityVerificationSucceeded が false の場合、AIは絶対に債権の種類・金額・債権者名などの内容を
  一切開示してはいけません。本人確認ができなかった旨と、担当者から改めて連絡する旨のみを伝えて
  会話を終了してください。この場合、requiresHumanFollowUp は必ず true にしてください。
- identityVerificationSucceeded が true の場合のみ、債権内容(残高・経過日数)を伝えてよいです。
- 会話の中でAIが自発的に減額・和解条件・分割回数などの交渉条件を提示することは絶対に禁止です。
  相手から減額等の相談が出た場合は「担当者から改めてご連絡します」と述べて交渉に応じず、
  requiresHumanFollowUp を true にしてください。
- 相手の発言に弁護士介入・破産・債務不存在の主張・苦情のいずれかが含まれた場合、AIは即座に
  「担当者からご連絡します」等で会話を終了し、detectedComplianceTrigger に該当する値
  (ATTORNEY_INVOLVED/BANKRUPTCY_OR_REHAB/DEBT_DISPUTE/COMPLAINT_IN_PROGRESS)を設定し、
  requiresHumanFollowUp を true にしてください。該当しない場合は null にしてください。
- 相手が具体的な支払可能日・金額を約束した場合のみ paymentPromiseDate(YYYY-MM-DD)と
  paymentPromiseAmount を設定してください。約束がなければ両方 null にしてください。
  入力の today(今日の日付)を基準に、「来月10日」等の相対表現を実際の日付に変換してください。
- summary はスタッフが後で読む前提で、日本語2〜3文の客観的な要約にしてください。
- transcript は speaker "AI" と "DEBTOR" の交互発話を2〜10ターン程度、自然な日本語の会話体で
  生成してください。creative but realistic — 誇張した演技的表現は避けてください。`;

/**
 * The only function other modules should call to simulate an AI voice call
 * conversation. This system has no real telephony integration (Twilio /
 * Amazon Connect) — this generates a plausible transcript + structured
 * outcome fields for the demo/PoC, matching the "approved scenario + limited
 * AI response + immediate stop + human handoff" architecture described in
 * the feature request, with the hard rules enforced in the prompt above
 * (and re-checked by the caller, not just trusted from the model output).
 */
export async function simulateVoiceCall(input: VoiceCallSimulationInput): Promise<VoiceCallSimulationResult> {
  const client = getAnthropicClient();

  const message = await client.messages.parse({
    model: getAiModel(),
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `以下の条件でAI自動架電シミュレーションを生成してください(JSON形式):\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(VoiceCallSimulationResultSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("AI応答を期待するスキーマに解析できませんでした");
  }

  return message.parsed_output;
}
