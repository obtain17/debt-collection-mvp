import "dotenv/config";
import { subDays, addDays } from "date-fns";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db/prisma";
import { scheduleForClaim } from "../lib/dunning/scheduleForClaim";
import { runClaimAnalysis } from "../lib/ai/runClaimAnalysis";
import { generateScheduleFromProposal } from "../lib/schedule/generateScheduleFromProposal";
import { cancelPendingCommunications } from "../lib/dunning/cancelPendingCommunications";
import { createPaymentForClaim } from "../lib/payments/createPaymentForClaim";
import { seedBulkDemoData } from "./seedBulk";
import type { $Enums } from "../generated/prisma/client";

// Overridable so the public demo deployment can use a strong, non-public
// password while local Docker Compose usage keeps the documented default.
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo1234";
let nextVirtualAccountNumber = 9000000001;

interface DebtorSeed {
  type: "INDIVIDUAL" | "COMPANY";
  name: string;
  nameKana?: string;
  email: string;
  phone: string;
  addressLine: string;
  ageBracket?: string;
  occupation?: string;
  industry?: string;
  employeeCountBracket?: string;
  yearsInBusiness?: number;
  employerName?: string;
  identityVerificationStatus?: "UNVERIFIED" | "PARTIAL" | "VERIFIED";
  dateOfBirth?: string; // "YYYY-MM-DD"
  secretQuestion?: string;
  secretAnswer?: string;
}

interface ClaimSeed {
  debtor: DebtorSeed;
  claimType: string;
  principalAmount: number;
  currentBalance: number;
  daysOverdue: number; // negative = not yet due
  hasCollateral?: boolean;
  collateralDescription?: string;
  priorDefaultCount?: number;
  status?:
    | "ACTIVE"
    | "IN_NEGOTIATION"
    | "PLAN_AGREED"
    | "SETTLED"
    | "WRITTEN_OFF"
    | "LEGAL_ESCALATION";
  payments?: Array<{ daysAgo: number; amount: number }>;
  legacyHistory?: Array<{
    daysAgo: number;
    description: string;
    channel: string;
    type?: $Enums.ActivityType;
  }>;
  notes?: string[];
  // Ledger detail (Phase 1 additions)
  originalCreditorName?: string;
  claimAcquiredDaysAgo?: number;
  acquisitionPrice?: number;
  interestAmount?: number;
  lateDamageAmount?: number;
  contractDaysBeforeDue?: number;
  statuteLimitationDaysFromNow?: number;
  legalTitles?: Array<"JUDGMENT" | "PAYMENT_ORDER" | "NOTARIZED_DEED">;
  hasGuarantor?: boolean;
  guarantorDescription?: string;
  complianceFlags?: Array<{
    flagType:
      | "ATTORNEY_INVOLVED"
      | "BANKRUPTCY_OR_REHAB"
      | "DEBT_DISPUTE"
      | "DECEASED"
      | "INHERITANCE_PENDING"
      | "IDENTITY_UNVERIFIED"
      | "COMPLAINT_IN_PROGRESS"
      | "MISBILLING_SUSPECTED"
      | "STATUTE_REVIEW"
      | "PHONE_PROHIBITED"
      | "MAIL_PROHIBITED"
      | "SMS_PROHIBITED"
      | "ALL_AUTOMATION_PROHIBITED";
    reason?: string;
  }>;
}

async function resetDatabase() {
  // Break the Claim <-> ClaimAnalysis cycle first, then delete in dependency order.
  await prisma.claim.updateMany({ data: { latestAnalysisId: null } });
  await prisma.aiVoiceCallLog.deleteMany();
  await prisma.paymentPlanProposal.deleteMany();
  await prisma.negotiationAccessToken.deleteMany();
  await prisma.scheduledCommunication.deleteMany();
  await prisma.complianceFlag.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.note.deleteMany();
  await prisma.paymentScheduleItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.incomingDeposit.deleteMany();
  await prisma.claimAnalysis.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.dunningStep.deleteMany();
  await prisma.dunningRule.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.negotiationRule.deleteMany();
  await prisma.negotiationRule.deleteMany();
  await prisma.aiVoiceSettings.deleteMany();
  await prisma.debtor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function createDefaultDunningRule(organizationId: string) {
  return prisma.dunningRule.create({
    data: {
      organizationId,
      name: "標準督促ルール",
      isDefault: true,
      steps: {
        create: [
          { dayOffset: 0, channel: "EMAIL", tone: "EMPATHETIC", templateKey: "FRIENDLY_REMINDER", order: 1 },
          { dayOffset: 7, channel: "AI_VOICE_CALL", tone: "NEUTRAL_FIRM", templateKey: "FRIENDLY_REMINDER", order: 2 },
          { dayOffset: 14, channel: "EMAIL", tone: "NEUTRAL_FIRM", templateKey: "FIRM_NOTICE", order: 3 },
          { dayOffset: 14, channel: "SMS", tone: "NEUTRAL_FIRM", templateKey: "FIRM_NOTICE", order: 4 },
          { dayOffset: 30, channel: "EMAIL", tone: "FORMAL_FINAL_NOTICE", templateKey: "FINAL_NOTICE", order: 5 },
          { dayOffset: 30, channel: "LETTER", tone: "FORMAL_FINAL_NOTICE", templateKey: "FINAL_NOTICE", order: 6 },
        ],
      },
    },
  });
}

async function createDefaultNegotiationRule(organizationId: string) {
  return prisma.negotiationRule.create({ data: { organizationId } });
}

/** Enabled by default so the demo shows AI音声自動督促 working without an extra manual setup step. */
async function createDefaultAiVoiceSettings(organizationId: string) {
  return prisma.aiVoiceSettings.create({ data: { organizationId, enabled: true } });
}

async function createSampleMessageTemplate(organizationId: string, userId: string) {
  return prisma.messageTemplate.create({
    data: {
      organizationId,
      key: "FRIENDLY_REMINDER",
      label: "お支払いのご案内(法務確認済み)",
      tone: "EMPATHETIC",
      legalApproved: true,
      createdByUserId: userId,
      subjectTemplate: "【{{organizationName}}】お支払いのご案内",
      bodyTemplate: [
        "{{debtorName}} 様",
        "",
        "平素より大変お世話になっております。{{organizationName}}でございます。",
        "{{claimType}}(現在残高: {{currentBalance}})につきまして、現時点でご入金が確認できておりません。",
        "行き違いでのご入金の場合は本メールをご容赦ください。",
        "お支払い状況のご確認やご相談は、以下の専用ページからお願いいたします。",
        "{{portalUrl}}",
        "",
        "{{organizationName}} 債権管理部",
      ].join("\n"),
    },
  });
}

const ORG1_CLAIMS: ClaimSeed[] = [
  {
    claimType: "証書貸付",
    principalAmount: 3_000_000,
    currentBalance: 2_800_000,
    daysOverdue: 5,
    priorDefaultCount: 0,
    debtor: {
      type: "INDIVIDUAL", name: "田中一郎", nameKana: "タナカイチロウ",
      email: "tanaka.ichiro@example.com", phone: "090-1111-2222", addressLine: "東京都大田区蒲田1-1-1",
      ageBracket: "40代", occupation: "会社員", dateOfBirth: "1980-05-15",
    },
  },
  {
    claimType: "カードローン",
    principalAmount: 1_500_000,
    currentBalance: 1_500_000,
    daysOverdue: 20,
    debtor: {
      type: "INDIVIDUAL", name: "佐々木花子", nameKana: "ササキハナコ",
      email: "sasaki.hanako@example.com", phone: "090-2222-3333", addressLine: "神奈川県横浜市西区2-2-2",
      ageBracket: "30代", occupation: "パート",
    },
  },
  {
    claimType: "証書貸付",
    principalAmount: 5_000_000,
    currentBalance: 4_200_000,
    daysOverdue: 40,
    hasCollateral: true,
    collateralDescription: "自宅土地建物(第二順位抵当権)",
    priorDefaultCount: 1,
    debtor: {
      type: "INDIVIDUAL", name: "渡辺次郎", nameKana: "ワタナベジロウ",
      email: "watanabe.jiro@example.com", phone: "090-3333-4444", addressLine: "東京都品川区3-3-3",
      ageBracket: "50代", occupation: "自営業",
      dateOfBirth: "1975-03-20", secretQuestion: "出身地は?", secretAnswer: "東京",
    },
    legacyHistory: [
      { daysAgo: 35, description: "電話にて本人と連絡、分割返済の相談を受けた", channel: "PHONE" },
      { daysAgo: 3, description: "SMSが不達でした", channel: "SMS", type: "SMS_UNDELIVERED" },
    ],
    notes: ["本人より「来月まとまった入金がある」と申告あり。継続フォロー要。"],
    interestAmount: 120_000,
    lateDamageAmount: 45_000,
    contractDaysBeforeDue: 365 * 3,
    hasGuarantor: true,
    guarantorDescription: "配偶者(連帯保証人)",
  },
  {
    claimType: "カードローン",
    principalAmount: 800_000,
    currentBalance: 300_000,
    daysOverdue: 2,
    debtor: {
      type: "INDIVIDUAL", name: "小林美咲", nameKana: "コバヤシミサキ",
      email: "kobayashi.misaki@example.com", phone: "090-4444-5555", addressLine: "東京都大田区蒲田4-4-4",
      ageBracket: "20代", occupation: "会社員", employerName: "株式会社サンライズ物流",
      dateOfBirth: "1998-11-02",
      identityVerificationStatus: "VERIFIED",
    },
    legacyHistory: [
      { daysAgo: 1, description: "債務者から折り返しの電話がありました", channel: "PHONE", type: "DEBTOR_CALLBACK" },
    ],
    payments: [
      { daysAgo: 60, amount: 250_000 },
      { daysAgo: 30, amount: 250_000 },
    ],
  },
  {
    claimType: "証書貸付",
    principalAmount: 10_000_000,
    currentBalance: 9_500_000,
    daysOverdue: 100,
    hasCollateral: true,
    collateralDescription: "事業用不動産(第一順位抵当権)",
    priorDefaultCount: 2,
    status: "LEGAL_ESCALATION",
    originalCreditorName: "旧・関東信用保証株式会社",
    claimAcquiredDaysAgo: 200,
    acquisitionPrice: 7_800_000,
    interestAmount: 850_000,
    lateDamageAmount: 320_000,
    legalTitles: ["NOTARIZED_DEED"],
    complianceFlags: [
      { flagType: "ATTORNEY_INVOLVED", reason: "本人代理人弁護士より受任通知が到達" },
    ],
    debtor: {
      type: "INDIVIDUAL", name: "中村健太", nameKana: "ナカムラケンタ",
      email: "nakamura.kenta@example.com", phone: "090-5555-6666", addressLine: "東京都大田区西蒲田5-5-5",
      ageBracket: "50代", occupation: "自営業(飲食店経営)",
    },
    legacyHistory: [
      { daysAgo: 90, description: "督促状(書面)を送付済み(システム導入前)", channel: "LETTER" },
      { daysAgo: 60, description: "電話連絡するも本人と連絡取れず", channel: "PHONE" },
      { daysAgo: 20, description: "内容証明郵便を送付", channel: "LETTER" },
      { daysAgo: 2, description: "郵便が返送されました", channel: "LETTER", type: "MAIL_RETURNED" },
    ],
    notes: ["再三の連絡に応答なし。法務部門への引き継ぎを検討中。"],
    statuteLimitationDaysFromNow: 45,
  },
  {
    claimType: "カードローン",
    principalAmount: 600_000,
    currentBalance: 600_000,
    daysOverdue: -10,
    debtor: {
      type: "INDIVIDUAL", name: "山本さくら", nameKana: "ヤマモトサクラ",
      email: "yamamoto.sakura@example.com", phone: "090-6666-7777", addressLine: "東京都大田区東蒲田6-6-6",
      ageBracket: "30代", occupation: "会社員",
    },
  },
  {
    claimType: "事業性ローン",
    principalAmount: 8_000_000,
    currentBalance: 7_000_000,
    daysOverdue: 15,
    status: "IN_NEGOTIATION",
    debtor: {
      type: "INDIVIDUAL", name: "松本大輔", nameKana: "マツモトダイスケ",
      email: "matsumoto.daisuke@example.com", phone: "090-7777-8888", addressLine: "東京都大田区南蒲田7-7-7",
      ageBracket: "40代", occupation: "自営業(小売店経営)",
    },
    legacyHistory: [
      { daysAgo: 10, description: "ポータル経由で分割返済案の提案あり", channel: "PORTAL_MESSAGE" },
      { daysAgo: 5, description: "支払約束が履行されませんでした", channel: "PHONE", type: "PAYMENT_PROMISE_BROKEN" },
    ],
    notes: ["分割案を精査中。来週までに回答予定。"],
  },
  {
    claimType: "証書貸付",
    principalAmount: 2_000_000,
    currentBalance: 1_800_000,
    daysOverdue: 3,
    debtor: {
      type: "INDIVIDUAL", name: "井上真由美", nameKana: "イノウエマユミ",
      email: "inoue.mayumi@example.com", phone: "090-8888-9999", addressLine: "神奈川県川崎市中原区8-8-8",
      ageBracket: "40代", occupation: "会社員",
    },
    legacyHistory: [
      { daysAgo: 4, description: "郵便が返送されました", channel: "LETTER", type: "MAIL_RETURNED" },
    ],
  },
  {
    claimType: "カードローン",
    principalAmount: 1_200_000,
    currentBalance: 1_200_000,
    daysOverdue: 60,
    priorDefaultCount: 1,
    debtor: {
      type: "INDIVIDUAL", name: "木村隆", nameKana: "キムラタカシ",
      email: "kimura.takashi@example.com", phone: "090-9999-0000", addressLine: "東京都大田区蒲田本町9-9-9",
      ageBracket: "30代", occupation: "会社員",
    },
    legacyHistory: [
      { daysAgo: 50, description: "督促メールを送付済み(システム導入前)", channel: "EMAIL" },
    ],
  },
  {
    claimType: "証書貸付",
    principalAmount: 4_500_000,
    currentBalance: 4_500_000,
    daysOverdue: -5,
    debtor: {
      type: "INDIVIDUAL", name: "林陽子", nameKana: "ハヤシヨウコ",
      email: "hayashi.yoko@example.com", phone: "080-1111-2222", addressLine: "東京都大田区下丸子10-10-10",
      ageBracket: "50代", occupation: "会社員",
    },
  },
  {
    claimType: "事業性ローン",
    principalAmount: 15_000_000,
    currentBalance: 12_000_000,
    daysOverdue: 30,
    hasCollateral: true,
    collateralDescription: "工場設備一式",
    debtor: {
      type: "INDIVIDUAL", name: "斎藤修", nameKana: "サイトウオサム",
      email: "saito.osamu@example.com", phone: "080-2222-3333", addressLine: "東京都大田区久が原11-11-11",
      ageBracket: "50代", occupation: "自営業(製造業)",
    },
  },
  {
    claimType: "カードローン",
    principalAmount: 500_000,
    currentBalance: 200_000,
    daysOverdue: 1,
    debtor: {
      type: "INDIVIDUAL", name: "清水彩", nameKana: "シミズアヤ",
      email: "shimizu.aya@example.com", phone: "080-3333-4444", addressLine: "東京都大田区千鳥12-12-12",
      ageBracket: "20代", occupation: "会社員",
    },
    payments: [{ daysAgo: 15, amount: 300_000 }],
  },
  {
    claimType: "手形貸付",
    principalAmount: 20_000_000,
    currentBalance: 18_000_000,
    daysOverdue: 50,
    hasCollateral: true,
    collateralDescription: "工場土地建物",
    priorDefaultCount: 1,
    debtor: {
      type: "COMPANY", name: "山田工業有限会社", nameKana: "ヤマダコウギョウ",
      email: "keiri@yamada-kogyo.example.com", phone: "03-1111-2222", addressLine: "東京都大田区羽田13-13-13",
      industry: "製造業(金属加工)", employeeCountBracket: "10-30名", yearsInBusiness: 25,
    },
    legacyHistory: [
      { daysAgo: 45, description: "経理担当者と電話で協議、支払遅延の事情説明を受けた", channel: "PHONE" },
    ],
    notes: ["取引先からの入金遅延が原因とのこと。来月には解消見込みと説明あり。"],
    interestAmount: 680_000,
    lateDamageAmount: 210_000,
    legalTitles: ["JUDGMENT"],
    hasGuarantor: true,
    guarantorDescription: "代表取締役(連帯保証人)",
  },
  {
    claimType: "カードローン",
    principalAmount: 500_000,
    currentBalance: 0,
    daysOverdue: 80,
    status: "SETTLED",
    debtor: {
      type: "INDIVIDUAL", name: "森田真一", nameKana: "モリタシンイチ",
      email: "morita.shinichi@example.com", phone: "080-4444-5555", addressLine: "東京都大田区大森14-14-14",
      ageBracket: "40代", occupation: "会社員", identityVerificationStatus: "VERIFIED",
    },
    payments: [
      { daysAgo: 40, amount: 300_000 },
      { daysAgo: 10, amount: 200_000 },
    ],
  },
];

const ORG2_CLAIMS: ClaimSeed[] = [
  {
    claimType: "売掛金",
    principalAmount: 5_000_000,
    currentBalance: 5_000_000,
    daysOverdue: 10,
    debtor: {
      type: "COMPANY", name: "株式会社アオゾラ商事", nameKana: "アオゾラショウジ",
      email: "keiri@aozora-shoji.example.com", phone: "03-2222-3333", addressLine: "東京都港区芝1-1-1",
      industry: "卸売業", employeeCountBracket: "30-50名", yearsInBusiness: 18,
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 3_200_000,
    currentBalance: 3_200_000,
    daysOverdue: 25,
    debtor: {
      type: "COMPANY", name: "有限会社フジワラ物産", nameKana: "フジワラブッサン",
      email: "keiri@fujiwara-bussan.example.com", phone: "03-3333-4444", addressLine: "東京都江東区豊洲2-2-2",
      industry: "商社", employeeCountBracket: "10-30名", yearsInBusiness: 12,
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 8_500_000,
    currentBalance: 6_000_000,
    daysOverdue: 45,
    priorDefaultCount: 1,
    debtor: {
      type: "COMPANY", name: "株式会社ミドリ工業", nameKana: "ミドリコウギョウ",
      email: "keiri@midori-kogyo.example.com", phone: "03-4444-5555", addressLine: "埼玉県川口市3-3-3",
      industry: "製造業", employeeCountBracket: "50-100名", yearsInBusiness: 30,
    },
    legacyHistory: [
      { daysAgo: 40, description: "資金繰りの状況についてヒアリング実施", channel: "PHONE" },
      { daysAgo: 20, description: "一部入金あり。残額の支払時期は未定との回答", channel: "EMAIL" },
    ],
  },
  {
    claimType: "売掛金",
    principalAmount: 900_000,
    currentBalance: 900_000,
    daysOverdue: 5,
    debtor: {
      type: "INDIVIDUAL", name: "田村商店(田村健一)", nameKana: "タムラケンイチ",
      email: "tamura.kenichi@example.com", phone: "090-5555-1111", addressLine: "千葉県船橋市4-4-4",
      ageBracket: "50代", occupation: "自営業(小売)",
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 12_000_000,
    currentBalance: 12_000_000,
    daysOverdue: 70,
    priorDefaultCount: 2,
    status: "LEGAL_ESCALATION",
    debtor: {
      type: "COMPANY", name: "株式会社ヒカリ流通", nameKana: "ヒカリリュウツウ",
      email: "keiri@hikari-ryutsu.example.com", phone: "03-5555-6666", addressLine: "東京都足立区5-5-5",
      industry: "運輸・物流業", employeeCountBracket: "30-50名", yearsInBusiness: 15,
    },
    legacyHistory: [
      { daysAgo: 65, description: "督促状(書面)を送付済み(システム導入前)", channel: "LETTER" },
      { daysAgo: 40, description: "先方担当者と面談、支払計画の提示を求めるも回答なし", channel: "PHONE" },
      { daysAgo: 15, description: "内容証明郵便を送付", channel: "LETTER" },
    ],
    notes: ["支払意思が確認できず。法的措置の検討要。"],
    legalTitles: ["PAYMENT_ORDER"],
    complianceFlags: [
      { flagType: "DEBT_DISPUTE", reason: "債務の一部について認否争いあり" },
    ],
    statuteLimitationDaysFromNow: 75,
  },
  {
    claimType: "売掛金",
    principalAmount: 2_500_000,
    currentBalance: 1_000_000,
    daysOverdue: 8,
    status: "IN_NEGOTIATION",
    debtor: {
      type: "COMPANY", name: "有限会社サクラ食品", nameKana: "サクラショクヒン",
      email: "keiri@sakura-shokuhin.example.com", phone: "03-6666-7777", addressLine: "東京都墨田区6-6-6",
      industry: "食品製造業", employeeCountBracket: "10-30名", yearsInBusiness: 20,
    },
    payments: [{ daysAgo: 20, amount: 1_500_000 }],
    legacyHistory: [
      { daysAgo: 5, description: "分割返済案(月額20万円×5回)の提案あり", channel: "PORTAL_MESSAGE" },
    ],
    notes: ["分割案を検討中。次回入金予定日を確認すること。"],
  },
  {
    claimType: "売掛金",
    principalAmount: 15_000_000,
    currentBalance: 15_000_000,
    daysOverdue: -15,
    debtor: {
      type: "COMPANY", name: "株式会社ノザワ建材", nameKana: "ノザワケンザイ",
      email: "keiri@nozawa-kenzai.example.com", phone: "03-7777-8888", addressLine: "東京都北区7-7-7",
      industry: "建設資材卸売業", employeeCountBracket: "50-100名", yearsInBusiness: 40,
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 6_800_000,
    currentBalance: 6_800_000,
    daysOverdue: 18,
    debtor: {
      type: "COMPANY", name: "加藤精密株式会社", nameKana: "カトウセイミツ",
      email: "keiri@kato-seimitsu.example.com", phone: "03-8888-9999", addressLine: "神奈川県横浜市鶴見区8-8-8",
      industry: "精密機械製造業", employeeCountBracket: "30-50名", yearsInBusiness: 22,
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 4_300_000,
    currentBalance: 4_300_000,
    daysOverdue: 33,
    debtor: {
      type: "COMPANY", name: "株式会社イワサキ運輸", nameKana: "イワサキウンユ",
      email: "keiri@iwasaki-unyu.example.com", phone: "03-9999-0000", addressLine: "東京都荒川区9-9-9",
      industry: "運輸業", employeeCountBracket: "10-30名", yearsInBusiness: 10,
    },
    legacyHistory: [
      { daysAgo: 28, description: "督促メールを送付済み(システム導入前)", channel: "EMAIL" },
    ],
  },
  {
    claimType: "売掛金",
    principalAmount: 1_100_000,
    currentBalance: 1_100_000,
    daysOverdue: 2,
    debtor: {
      type: "INDIVIDUAL", name: "遠藤商会(遠藤正)", nameKana: "エンドウタダシ",
      email: "endo.tadashi@example.com", phone: "090-1234-5678", addressLine: "千葉県市川市10-10-10",
      ageBracket: "60代", occupation: "自営業(卸売)",
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 9_000_000,
    currentBalance: 3_000_000,
    daysOverdue: 90,
    priorDefaultCount: 1,
    status: "LEGAL_ESCALATION",
    debtor: {
      type: "COMPANY", name: "株式会社タカギ電子", nameKana: "タカギデンシ",
      email: "keiri@takagi-denshi.example.com", phone: "03-1010-2020", addressLine: "東京都大田区蒲田11-11-11",
      industry: "電子部品製造業", employeeCountBracket: "10-30名", yearsInBusiness: 14,
    },
    payments: [{ daysAgo: 45, amount: 6_000_000 }],
    legacyHistory: [
      { daysAgo: 80, description: "督促状(書面)を送付済み(システム導入前)", channel: "LETTER" },
      { daysAgo: 50, description: "一部入金あり(600万円)。残額は分割希望との申し出", channel: "EMAIL" },
      { daysAgo: 10, description: "分割案の履行が滞っており、再度連絡するも応答なし", channel: "PHONE" },
    ],
    notes: ["分割案が履行されず。法務部門と対応を協議中。"],
  },
  {
    claimType: "売掛金",
    principalAmount: 2_000_000,
    currentBalance: 2_000_000,
    daysOverdue: -7,
    debtor: {
      type: "COMPANY", name: "有限会社モリタ包装", nameKana: "モリタホウソウ",
      email: "keiri@morita-hoso.example.com", phone: "03-1111-3333", addressLine: "東京都江戸川区12-12-12",
      industry: "包装資材製造業", employeeCountBracket: "10-30名", yearsInBusiness: 16,
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 3_700_000,
    currentBalance: 3_700_000,
    daysOverdue: 12,
    debtor: {
      type: "COMPANY", name: "株式会社カワムラ食品", nameKana: "カワムラショクヒン",
      email: "keiri@kawamura-shokuhin.example.com", phone: "03-2222-4444", addressLine: "東京都板橋区13-13-13",
      industry: "食品製造業", employeeCountBracket: "30-50名", yearsInBusiness: 28,
    },
  },
  {
    claimType: "売掛金",
    principalAmount: 7_200_000,
    currentBalance: 6_500_000,
    daysOverdue: 55,
    hasCollateral: true,
    collateralDescription: "機械設備(工作機械一式)",
    debtor: {
      type: "COMPANY", name: "新井金属加工株式会社", nameKana: "アライキンゾクカコウ",
      email: "keiri@arai-kinzoku.example.com", phone: "03-3333-5555", addressLine: "東京都大田区京浜島14-14-14",
      industry: "金属加工業", employeeCountBracket: "10-30名", yearsInBusiness: 35,
    },
    legacyHistory: [
      { daysAgo: 50, description: "工場訪問の上、事情聴取実施", channel: "PHONE" },
    ],
  },
];

async function seedOrganization(
  name: string,
  type: "CREDIT_UNION" | "COMPANY",
  users: Array<{ name: string; email: string; role: "ADMIN" | "AGENT" }>,
  claims: ClaimSeed[],
) {
  const org = await prisma.organization.create({ data: { name, type } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const createdUsers = [];
  for (const u of users) {
    createdUsers.push(
      await prisma.user.create({
        data: { organizationId: org.id, name: u.name, email: u.email, role: u.role, passwordHash },
      }),
    );
  }
  const agents = createdUsers.filter((u) => u.role === "AGENT");
  const admin = createdUsers.find((u) => u.role === "ADMIN") ?? createdUsers[0];

  const dunningRule = await createDefaultDunningRule(org.id);
  await createDefaultNegotiationRule(org.id);
  await createDefaultAiVoiceSettings(org.id);
  await createSampleMessageTemplate(org.id, admin.id);

  let agentIndex = 0;
  for (const c of claims) {
    const { dateOfBirth, ...debtorRest } = c.debtor;
    const debtor = await prisma.debtor.create({
      data: {
        organizationId: org.id,
        ...debtorRest,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      },
    });

    const assignedAgent = agents.length > 0 ? agents[agentIndex % agents.length] : undefined;
    agentIndex += 1;

    const originalDueDate = subDays(new Date(), c.daysOverdue);

    const claim = await prisma.claim.create({
      data: {
        organizationId: org.id,
        debtorId: debtor.id,
        assignedAgentId: assignedAgent?.id,
        claimType: c.claimType,
        principalAmount: c.principalAmount,
        currentBalance: c.currentBalance,
        originalDueDate,
        status: c.status ?? "ACTIVE",
        hasCollateral: c.hasCollateral ?? false,
        collateralDescription: c.collateralDescription,
        priorDefaultCount: c.priorDefaultCount ?? 0,
        originalCreditorName: c.originalCreditorName,
        claimAcquiredAt: c.claimAcquiredDaysAgo != null ? subDays(new Date(), c.claimAcquiredDaysAgo) : undefined,
        acquisitionPrice: c.acquisitionPrice,
        interestAmount: c.interestAmount ?? 0,
        lateDamageAmount: c.lateDamageAmount ?? 0,
        contractDate: c.contractDaysBeforeDue != null ? subDays(originalDueDate, c.contractDaysBeforeDue) : undefined,
        statuteLimitationDate:
          c.statuteLimitationDaysFromNow != null ? addDays(new Date(), c.statuteLimitationDaysFromNow) : undefined,
        legalTitles: c.legalTitles ?? [],
        hasGuarantor: c.hasGuarantor ?? false,
        guarantorDescription: c.guarantorDescription,
        virtualAccountNumber: String(nextVirtualAccountNumber++),
      },
    });

    for (const flag of c.complianceFlags ?? []) {
      await prisma.complianceFlag.create({
        data: { claimId: claim.id, flagType: flag.flagType, reason: flag.reason, setByUserId: assignedAgent?.id },
      });
    }

    for (const p of c.payments ?? []) {
      await prisma.payment.create({
        data: { claimId: claim.id, amount: p.amount, paidAt: subDays(new Date(), p.daysAgo), source: "銀行振込" },
      });
    }

    for (const h of c.legacyHistory ?? []) {
      await prisma.activityLog.create({
        data: {
          claimId: claim.id,
          userId: assignedAgent?.id,
          type: h.type ?? "COMMUNICATION_SENT",
          description: h.description,
          metadata: { channel: h.channel },
          createdAt: subDays(new Date(), h.daysAgo),
        },
      });
    }

    for (const n of c.notes ?? []) {
      await prisma.note.create({
        data: { claimId: claim.id, userId: assignedAgent?.id ?? createdUsers[0].id, body: n },
      });
    }

    await scheduleForClaim(claim.id);
  }

  return { org, users: createdUsers, dunningRuleId: dunningRule.id, agentIds: agents.map((a) => a.id) };
}

async function seedSettlementDemo(debtorName: string) {
  const claim = await prisma.claim.findFirst({
    where: { debtor: { name: debtorName } },
    include: { debtor: true },
  });
  if (!claim) return;
  const admin = await prisma.user.findFirst({ where: { organizationId: claim.organizationId, role: "ADMIN" } });

  const per = Math.floor(claim.currentBalance / 3);
  const installments = [
    { month: 1, amount: per },
    { month: 2, amount: per },
    { month: 3, amount: claim.currentBalance - per * 2 },
  ];
  const firstPaymentDate = subDays(new Date(), 39);

  const proposal = await prisma.paymentPlanProposal.create({
    data: {
      claimId: claim.id,
      proposedBy: "DEBTOR",
      installments,
      totalAmount: claim.currentBalance,
      settlementOffer: false,
      status: "APPROVED",
      reviewedByUserId: admin?.id,
      reviewedAt: subDays(new Date(), 40),
      debtorConsentedAt: firstPaymentDate,
      debtorConsentName: claim.debtor.name,
      firstPaymentDate,
    },
  });

  await generateScheduleFromProposal(claim.id, {
    installments: proposal.installments,
    firstPaymentDate: proposal.firstPaymentDate,
    desiredPaymentDay: proposal.desiredPaymentDay,
  });
  await cancelPendingCommunications(claim.id, "返済合意成立のため自動督促を停止しました(デモ投入)");
  await prisma.claim.update({ where: { id: claim.id }, data: { status: "PLAN_AGREED" } });

  const [firstItem] = await prisma.paymentScheduleItem.findMany({
    where: { claimId: claim.id },
    orderBy: { dueDate: "asc" },
    take: 1,
  });
  if (firstItem) {
    await createPaymentForClaim({
      claimId: claim.id,
      amount: firstItem.amount,
      paidAt: firstItem.dueDate,
      source: "銀行振込",
      confirmedByUserId: admin?.id,
    });
  }
}

async function seedDepositDemo(organizationId: string, matchedDebtorName: string) {
  const claim = await prisma.claim.findFirst({
    where: { organizationId, debtor: { name: matchedDebtorName } },
    include: { debtor: true },
  });
  if (!claim) return;
  const admin = await prisma.user.findFirst({ where: { organizationId, role: "ADMIN" } });

  const matchedAmount = Math.min(claim.currentBalance, 50_000);
  const matchStatus = matchedAmount < claim.currentBalance ? "PARTIAL" : "MATCHED";
  const matchedDeposit = await prisma.incomingDeposit.create({
    data: {
      organizationId,
      amount: matchedAmount,
      payerName: claim.debtor.name,
      depositedAt: subDays(new Date(), 2),
      source: "画像取込",
      matchStatus,
      resolvedByUserId: admin?.id,
      resolvedAt: subDays(new Date(), 2),
    },
  });
  await createPaymentForClaim({
    claimId: claim.id,
    amount: matchedAmount,
    paidAt: subDays(new Date(), 2),
    source: "画像取込",
    payerName: claim.debtor.name,
    matchStatus,
    incomingDepositId: matchedDeposit.id,
    confirmedByUserId: admin?.id,
  });

  await prisma.incomingDeposit.create({
    data: {
      organizationId,
      amount: 30_000,
      payerName: "フメイ タロウ",
      depositedAt: subDays(new Date(), 1),
      source: "画像取込",
      matchStatus: "UNMATCHED",
    },
  });
}

async function main() {
  const existingOrgs = await prisma.organization.count();
  if (existingOrgs > 0 && process.env.FORCE_RESEED !== "true") {
    console.log(
      `既にデータが存在するため、シードをスキップします(組織数: ${existingOrgs})。再投入する場合は FORCE_RESEED=true を指定してください。`,
    );
    return;
  }

  console.log("シードデータ投入を開始します...");
  await resetDatabase();

  const { org: org1, dunningRuleId: org1RuleId, agentIds: org1AgentIds } = await seedOrganization(
    "デモ信用金庫",
    "CREDIT_UNION",
    [
      { name: "山田太郎", email: "yamada.taro@demo-shinkin.example", role: "ADMIN" },
      { name: "佐藤花子", email: "sato.hanako@demo-shinkin.example", role: "AGENT" },
      { name: "鈴木一郎", email: "suzuki.ichiro@demo-shinkin.example", role: "AGENT" },
    ],
    ORG1_CLAIMS,
  );

  const { org: org2, dunningRuleId: org2RuleId, agentIds: org2AgentIds } = await seedOrganization(
    "デモ商事株式会社",
    "COMPANY",
    [
      { name: "高橋健二", email: "takahashi.kenji@demo-shoji.example", role: "ADMIN" },
      { name: "伊藤由紀", email: "ito.yuki@demo-shoji.example", role: "AGENT" },
    ],
    ORG2_CLAIMS,
  );

  console.log(`組織を作成しました: ${org1.name}, ${org2.name}`);

  await seedSettlementDemo("佐々木花子");
  await seedDepositDemo(org1.id, "山本さくら");
  await seedDepositDemo(org2.id, "株式会社アオゾラ商事");

  const allClaims = await prisma.claim.findMany({ select: { id: true } });
  console.log(`AI分析を実行します(全${allClaims.length}件、ANTHROPIC_API_KEY未設定時は未分析としてスキップ)...`);

  for (const [i, claim] of allClaims.entries()) {
    await runClaimAnalysis(claim.id);
    if ((i + 1) % 5 === 0) console.log(`  ${i + 1}/${allClaims.length} 件完了`);
  }

  // Bulk synthetic data for PoC demo scale (見せ方用の合成データ、実在の顧客ではない).
  // Kept separate from the hand-authored claims above: those get real AI
  // analysis; this bulk batch uses a heuristic stand-in (see
  // generateSyntheticAnalysis.ts) so 5,000 records don't mean 5,000 LLM calls.
  const bulkCount = Number(process.env.BULK_DEMO_CLAIM_COUNT ?? 5000);
  if (bulkCount > 0) {
    console.log(`バルクデモデータを生成します(合計${bulkCount}件、PoC実証用の合成データ)...`);
    await seedBulkDemoData(
      [
        { organizationId: org1.id, dunningRuleId: org1RuleId, agentIds: org1AgentIds, debtorSkew: "individual" },
        { organizationId: org2.id, dunningRuleId: org2RuleId, agentIds: org2AgentIds, debtorSkew: "company" },
      ],
      bulkCount,
      9_100_000_001,
    );
    console.log("バルクデモデータ生成が完了しました。");
  }

  console.log("シードデータ投入が完了しました。");
  console.log(`デモパスワード(全ユーザー共通): ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
