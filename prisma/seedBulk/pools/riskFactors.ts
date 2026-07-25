import type { $Enums } from "../../../generated/prisma/client";

type RiskTier = $Enums.RiskTier;

export const RISK_FACTOR_POOL: Record<RiskTier, string[]> = {
  LOW: ["直近の入金履歴あり", "連絡先の有効性が高い", "延滞日数が短い"],
  MEDIUM: ["支払遅延の常習性あり", "連絡が取りづらい時間帯がある", "残高に対して収入変動の兆候"],
  HIGH: ["複数回の督促に無反応", "過去に約束不履行歴あり", "連絡先の有効性に疑義"],
  CRITICAL: ["長期延滞が継続", "連絡不能状態が継続", "法的措置の要件に該当"],
};

export const RECOMMENDED_ACTION_POOL: Record<RiskTier, string[]> = {
  LOW: ["次回期日までの経過観察", "友好的なリマインド送付"],
  MEDIUM: ["電話による状況確認", "分割返済案の提示準備", "SMSでの支払案内送付"],
  HIGH: ["優先架電の実施", "上長への状況共有", "書面督促への切り替え検討"],
  CRITICAL: ["法務部門への相談", "内容証明郵便の送付検討", "時効管理の確認"],
};

export const APPROACH_BY_TIER: Record<RiskTier, $Enums.CollectionApproach> = {
  LOW: "MONITOR_ONLY",
  MEDIUM: "FRIENDLY_REMINDER",
  HIGH: "FIRM_NOTICE",
  CRITICAL: "LEGAL_ESCALATION_RECOMMENDED",
};

export const TONE_BY_TIER: Record<RiskTier, $Enums.Tone> = {
  LOW: "EMPATHETIC",
  MEDIUM: "EMPATHETIC",
  HIGH: "NEUTRAL_FIRM",
  CRITICAL: "FORMAL_FINAL_NOTICE",
};

export const CHANNEL_BY_TIER: Record<RiskTier, $Enums.Channel> = {
  LOW: "EMAIL",
  MEDIUM: "EMAIL",
  HIGH: "PHONE",
  CRITICAL: "LETTER",
};

export const REASONING_POOL: Record<RiskTier, string> = {
  LOW: "延滞日数が短く、支払能力・意思ともに大きな問題は見られません。",
  MEDIUM: "延滞が継続していますが、接触は可能な状況です。継続的なフォローが有効と考えられます。",
  HIGH: "接触・支払意思の両面で懸念があり、より積極的な対応が必要です。",
  CRITICAL: "長期延滞かつ接触困難な状況であり、法的手続きの検討が必要な段階です。",
};
