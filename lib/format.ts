const currencyFormatter = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });
const dateFormatter = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatYen(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatDate(date: Date | string): string {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(new Date(date));
}

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "対応中",
  IN_NEGOTIATION: "交渉中",
  PLAN_AGREED: "分割合意済み",
  SETTLED: "完済",
  WRITTEN_OFF: "償却",
  LEGAL_ESCALATION: "法的措置検討",
};

export const RISK_TIER_LABEL: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "最重要",
};

export const RISK_TIER_COLOR: Record<string, string> = {
  LOW: "bg-emerald-100 text-emerald-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export const CLAIM_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-slate-100 text-slate-700",
  IN_NEGOTIATION: "bg-blue-100 text-blue-800",
  PLAN_AGREED: "bg-indigo-100 text-indigo-800",
  SETTLED: "bg-emerald-100 text-emerald-800",
  WRITTEN_OFF: "bg-slate-200 text-slate-500",
  LEGAL_ESCALATION: "bg-red-100 text-red-800",
};

export const APPROACH_LABEL: Record<string, string> = {
  FRIENDLY_REMINDER: "友好的リマインド",
  FIRM_NOTICE: "強めの通知",
  SETTLEMENT_OFFER: "和解案の提示",
  INSTALLMENT_PLAN_PROPOSAL: "分割案の提案",
  LEGAL_ESCALATION_RECOMMENDED: "法務部門への相談推奨",
  MONITOR_ONLY: "経過観察",
};

export const TONE_LABEL: Record<string, string> = {
  EMPATHETIC: "共感的",
  NEUTRAL_FIRM: "中立的・毅然",
  FORMAL_FINAL_NOTICE: "最終通告(フォーマル)",
};

export const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "メール",
  SMS: "SMS",
  PHONE: "電話",
  LETTER: "郵送",
  PORTAL_MESSAGE: "ポータル",
  AI_VOICE_CALL: "AI音声電話",
  OPERATOR_CALL: "オペレーター架電",
};

export const COMMUNICATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "送信待ち",
  SENT: "送信済み",
  FAILED: "送信失敗",
  SKIPPED: "スキップ",
  DRAFT_PENDING_REVIEW: "承認待ち(下書き)",
  APPROVED: "承認済み(送信待ち)",
  REJECTED: "却下",
};

export const MAIL_CLASS_LABEL: Record<string, string> = {
  STANDARD: "普通郵便",
  REGISTERED: "書留",
};

export const NEGOTIATION_VERDICT_LABEL: Record<string, string> = {
  WITHIN_POLICY: "社内ルール内",
  SUPERVISOR_APPROVAL_REQUIRED: "上長承認必要",
  LEGAL_APPROVAL_REQUIRED: "法務承認必要",
  NOT_OFFERABLE: "提示不可",
};

export const NEGOTIATION_VERDICT_COLOR: Record<string, string> = {
  WITHIN_POLICY: "bg-emerald-100 text-emerald-800",
  SUPERVISOR_APPROVAL_REQUIRED: "bg-amber-100 text-amber-800",
  LEGAL_APPROVAL_REQUIRED: "bg-orange-100 text-orange-800",
  NOT_OFFERABLE: "bg-red-100 text-red-800",
};

export const DEPOSIT_MATCH_STATUS_LABEL: Record<string, string> = {
  UNMATCHED: "未処理",
  MATCHED: "一致",
  PARTIAL: "一部入金",
  OVERPAID: "過入金",
  MISENTERED: "誤入金",
  REVERSED: "取消済み",
};

export const DEPOSIT_MATCH_STATUS_COLOR: Record<string, string> = {
  UNMATCHED: "bg-amber-100 text-amber-800",
  MATCHED: "bg-emerald-100 text-emerald-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  OVERPAID: "bg-orange-100 text-orange-800",
  MISENTERED: "bg-red-100 text-red-800",
  REVERSED: "bg-slate-200 text-slate-500",
};

export const COMPLIANCE_FLAG_LABEL: Record<string, string> = {
  ATTORNEY_INVOLVED: "弁護士受任通知あり",
  BANKRUPTCY_OR_REHAB: "破産・再生手続中",
  DEBT_DISPUTE: "債務不存在を主張",
  DECEASED: "本人死亡",
  INHERITANCE_PENDING: "相続確認中",
  IDENTITY_UNVERIFIED: "本人確認未了",
  COMPLAINT_IN_PROGRESS: "苦情対応中",
  MISBILLING_SUSPECTED: "誤請求疑い",
  STATUTE_REVIEW: "時効確認中",
  PHONE_PROHIBITED: "電話禁止",
  MAIL_PROHIBITED: "郵送禁止",
  SMS_PROHIBITED: "SMS禁止",
  ALL_AUTOMATION_PROHIBITED: "全自動処理禁止",
};

export const LEGAL_TITLE_LABEL: Record<string, string> = {
  JUDGMENT: "判決",
  PAYMENT_ORDER: "支払督促",
  NOTARIZED_DEED: "公正証書",
};

export const IDENTITY_VERIFICATION_LABEL: Record<string, string> = {
  UNVERIFIED: "未確認",
  PARTIAL: "一部確認",
  VERIFIED: "確認済み",
};

export const IDENTITY_VERIFICATION_METHOD_LABEL: Record<string, string> = {
  PHONE_LAST4: "電話番号(下4桁)",
  DATE_OF_BIRTH: "生年月日",
  CLAIM_REFERENCE: "照会番号",
  SECRET_QUESTION: "秘密の質問",
  OTP: "ワンタイムコード",
};

export const RECOVERY_OUTCOME_LABEL: Record<string, string> = {
  PARTIAL: "一部回収",
  FULL: "完済",
  UNKNOWN: "不明",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
};

/** All ActivityType values, for the cross-claim audit log screen. */
export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  STATUS_CHANGE: "ステータス変更",
  COMMUNICATION_SENT: "督促送信",
  NOTE_ADDED: "メモ追加",
  PROPOSAL_SUBMITTED: "返済提案の提出",
  PROPOSAL_REVIEWED: "返済提案の審査",
  AI_ANALYSIS_RUN: "AI分析実行",
  PORTAL_ACCESSED: "交渉ポータルへのアクセス",
  COMPLIANCE_FLAG_SET: "コンプライアンスフラグ設定",
  COMPLIANCE_FLAG_CLEARED: "コンプライアンスフラグ解除",
  CALL_PLACED: "電話発信",
  CALL_NO_ANSWER: "電話不通",
  CALL_CONNECTED_DEBTOR: "本人と通話",
  CALL_CONNECTED_FAMILY: "家族等が応答",
  CALL_VOICEMAIL_LEFT: "留守番電話に折り返し依頼",
  DEBTOR_CALLBACK: "債務者からの折返し",
  PAYMENT_PROMISE_MADE: "支払約束",
  PAYMENT_PROMISE_BROKEN: "約束不履行",
  PAYMENT_RECEIVED: "入金受領",
  SMS_DELIVERED: "SMS到達",
  SMS_UNDELIVERED: "SMS不達",
  MAIL_DELIVERED: "郵便配達",
  MAIL_RETURNED: "郵便返送",
};

/** Manually-loggable contact outcomes shown in the "接触記録を追加" form. */
export const CONTACT_EVENT_LABEL: Record<string, string> = {
  CALL_PLACED: "電話発信",
  CALL_NO_ANSWER: "電話不通",
  CALL_CONNECTED_DEBTOR: "本人と通話",
  CALL_CONNECTED_FAMILY: "家族等が応答",
  CALL_VOICEMAIL_LEFT: "留守番電話に折り返し依頼",
  DEBTOR_CALLBACK: "債務者からの折返し",
  PAYMENT_PROMISE_MADE: "支払約束",
  PAYMENT_PROMISE_BROKEN: "約束不履行",
};

export const VOICE_CALL_OUTCOME_LABEL: Record<string, string> = {
  CONNECTED_DEBTOR: "本人と通話",
  CONNECTED_OTHER: "本人以外が応答",
  NO_ANSWER: "応答なし",
  VOICEMAIL_LEFT: "留守番電話に依頼のみ",
};

export const VOICE_CALL_OUTCOME_COLOR: Record<string, string> = {
  CONNECTED_DEBTOR: "bg-emerald-100 text-emerald-800",
  CONNECTED_OTHER: "bg-blue-100 text-blue-800",
  NO_ANSWER: "bg-slate-100 text-slate-600",
  VOICEMAIL_LEFT: "bg-amber-100 text-amber-800",
};

export const VOICE_TELEPHONY_PROVIDER_LABEL: Record<string, string> = {
  TWILIO: "Twilio型(Web組込・PoC向け)",
  AMAZON_CONNECT: "Amazon Connect型(金融機関向け管理・録音重視)",
};

export const VOICE_SPEECH_PROVIDER_LABEL: Record<string, string> = {
  OPENAI_REALTIME: "OpenAI Realtime API(低遅延音声対話)",
  AZURE_AI_SPEECH: "Azure AI Speech(音声認識・読み上げ)",
};
