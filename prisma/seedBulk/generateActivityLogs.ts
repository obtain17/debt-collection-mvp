import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import type { $Enums } from "../../generated/prisma/client";

export interface ActivityLogSeedInput {
  claimId: string;
  userId: string | null;
  status: $Enums.ClaimStatus;
  riskTier: $Enums.RiskTier;
  recoveryProbability: number;
  analysisId: string;
  originalDueDate: Date;
}

export interface ActivityLogSeedRow {
  id: string;
  claimId: string;
  userId: string | null;
  type: $Enums.ActivityType;
  description: string;
  metadata?: Record<string, string>;
  createdAt: Date;
}

const CONTACT_EVENTS: Array<{ type: $Enums.ActivityType; description: string }> = [
  { type: "CALL_PLACED", description: "架電を実施しました" },
  { type: "CALL_NO_ANSWER", description: "架電しましたが応答がありませんでした" },
  { type: "CALL_CONNECTED_DEBTOR", description: "本人と電話で連絡が取れました" },
  { type: "SMS_DELIVERED", description: "SMSが到達しました" },
  { type: "SMS_UNDELIVERED", description: "SMSが不達でした" },
  { type: "MAIL_DELIVERED", description: "郵便が配達されました" },
  { type: "MAIL_RETURNED", description: "郵便が返送されました" },
  { type: "DEBTOR_CALLBACK", description: "債務者から折り返しの連絡がありました" },
  { type: "PAYMENT_PROMISE_MADE", description: "支払時期についての約束がありました" },
];

const STATUS_CHANGE_DESCRIPTIONS: Partial<Record<$Enums.ClaimStatus, string>> = {
  IN_NEGOTIATION: "交渉ステータスへ移行しました",
  PLAN_AGREED: "分割返済案について合意しました",
  SETTLED: "完済に至りました",
  WRITTEN_OFF: "償却処理を行いました",
  LEGAL_ESCALATION: "法的措置の検討段階へ移行しました",
};

/** One AI_ANALYSIS_RUN entry (mirrors runClaimAnalysis.ts's real logging) plus 0-3 plausible contact/status entries. */
export function generateActivityLogs(input: ActivityLogSeedInput): ActivityLogSeedRow[] {
  const now = new Date();
  const rows: ActivityLogSeedRow[] = [
    {
      id: randomUUID(),
      claimId: input.claimId,
      userId: input.userId,
      type: "AI_ANALYSIS_RUN",
      description: `AI分析を実行しました(リスク: ${input.riskTier} / 回収可能性: ${Math.round(input.recoveryProbability * 100)}%)`,
      metadata: { analysisId: input.analysisId },
      createdAt: subDays(now, faker.number.int({ min: 0, max: 3 })),
    },
  ];

  const daysSinceDue = Math.max(1, Math.min(90, Math.round((now.getTime() - input.originalDueDate.getTime()) / 86_400_000)));
  const contactCount = faker.number.int({ min: 0, max: 2 });
  for (let i = 0; i < contactCount; i += 1) {
    const pick = faker.helpers.arrayElement(CONTACT_EVENTS);
    rows.push({
      id: randomUUID(),
      claimId: input.claimId,
      userId: input.userId,
      type: pick.type,
      description: pick.description,
      createdAt: subDays(now, faker.number.int({ min: 0, max: daysSinceDue })),
    });
  }

  const statusDescription = STATUS_CHANGE_DESCRIPTIONS[input.status];
  if (statusDescription) {
    rows.push({
      id: randomUUID(),
      claimId: input.claimId,
      userId: input.userId,
      type: "STATUS_CHANGE",
      description: statusDescription,
      metadata: { status: input.status },
      createdAt: subDays(now, faker.number.int({ min: 0, max: Math.min(daysSinceDue, 60) })),
    });
  }

  return rows;
}
