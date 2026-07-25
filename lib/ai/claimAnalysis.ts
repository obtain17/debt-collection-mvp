import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient, getAiModel } from "./client";
import { ClaimAnalysisResultSchema, type ClaimAnalysisResult } from "./schema";
import type { ClaimAnalysisInput } from "./buildAnalysisInput";

const SYSTEM_PROMPT = `あなたは日本の金融機関・サービサー等の債権管理スタッフを支援するAIアシスタントです。
あなた自身が債権を回収する主体ではありません。データを分析し、クライアント組織のスタッフが次に取るべき
行動を判断するための材料(リスク評価・回収可能性・推奨アプローチ)を提示することだけが役割です。

出力上の注意:
- 「回収します」「請求します」のような一人称での回収行為の宣言はしないでください。あくまで分析と提案に徹してください。
- recoveryProbabilityRationale と recommendedStrategy.reasoning は日本語で、2〜3文の簡潔な説明にしてください。
- 個別の法的助言(訴訟の成否等)は断定せず、必要であれば「法務部門への相談を推奨」に留めてください。
- keyRiskFactors は根拠のある具体的な要因を最大5件、簡潔な日本語の箇条書き文字列で返してください。
- 入力データに事実として無いことを創作しないでください。

スコアの意味を明確にするための追加フィールドについて:
- recoveryWindowDays: recoveryProbability が「何日以内に1円以上の入金がある確率」を指すのか、案件の状況
  (延滞日数・督促ステップ等)から妥当な日数(例: 30/60/90/180)を自分で判断して数値で返してください。
- expectedRecoveryType: 現在の残高・分割提案の状況から、想定される回収の性質を "PARTIAL"(一部回収が濃厚)
  "FULL"(完済が見込める)"UNKNOWN"(判断材料が不足)のいずれかで返してください。
- confidenceLevel: 入力データの量・具体性からこの分析全体への自信度を "LOW"/"MEDIUM"/"HIGH" で判定してください。
- dataInsufficient: interactionHistory や paymentHistory がほぼ空、または債務者属性が乏しい場合は true にし、
  dataInsufficiencyNote に具体的に何が不足しているか(例: 「接触履歴が0件のため反応傾向が不明」)を書いてください。
  データが十分な場合は false とし、dataInsufficiencyNote は省略してください。
- expectedRecoveryAmount12m: 今後12か月以内に回収が見込まれる金額(円)。currentBalance を超えない範囲で、
  recoveryProbability 等を踏まえた保守的な見積りにしてください。
- contactabilityScore/paymentWillingnessScore/paymentCapacityScore: recoveryProbability を単一値のまま
  終わらせず、「本人に接触できる可能性」「支払う意思がありそうか」「支払う経済的余力がありそうか」を
  それぞれ0〜1の独立したスコアとして分解してください(3つの平均が必ずしもrecoveryProbabilityと一致する
  必要はありません)。
- expectedRecoveryAmount: 現実的に回収できると見込まれる金額(円、currentBalance以下)。
- expectedCollectionCost: 今後の督促・交渉・法的手続き等にかかる概算コスト(円)。督促ステップ数や
  法的措置の要否から常識的な範囲で見積もってください(過大な精度を装わないこと)。
- recommendedActions: 次に取るべき具体的な行動を優先順位付きで最大5件、"order"(1始まりの整数)と
  "action"(日本語の一文、例: 「SMSで返済相談ページを案内する」)の配列で返してください。`;

/**
 * The only function other modules should call for AI-based claim analysis.
 * Swapping this for a trained ML model later means reimplementing this
 * function's body while keeping the same input/output signature.
 */
export async function analyzeClaimRisk(input: ClaimAnalysisInput): Promise<ClaimAnalysisResult> {
  const client = getAnthropicClient();

  const message = await client.messages.parse({
    model: getAiModel(),
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `以下の債権データを分析してください(JSON形式):\n\n${JSON.stringify(input, null, 2)}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ClaimAnalysisResultSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("AI応答を期待するスキーマに解析できませんでした");
  }

  return message.parsed_output;
}
