export const COMPANY_PREFIXES = ["株式会社", "有限会社", "合同会社"] as const;

export interface CompanyStem {
  kanji: string;
  kana: string;
}

export const COMPANY_STEMS: CompanyStem[] = [
  { kanji: "アオゾラ", kana: "アオゾラ" },
  { kanji: "サンライズ", kana: "サンライズ" },
  { kanji: "フジワラ", kana: "フジワラ" },
  { kanji: "ミドリ", kana: "ミドリ" },
  { kanji: "ヒカリ", kana: "ヒカリ" },
  { kanji: "サクラ", kana: "サクラ" },
  { kanji: "ノザワ", kana: "ノザワ" },
  { kanji: "カワムラ", kana: "カワムラ" },
  { kanji: "新井", kana: "アライ" },
  { kanji: "イワサキ", kana: "イワサキ" },
  { kanji: "タカギ", kana: "タカギ" },
  { kanji: "モリタ", kana: "モリタ" },
  { kanji: "大和", kana: "ヤマト" },
  { kanji: "旭", kana: "アサヒ" },
  { kanji: "共栄", kana: "キョウエイ" },
  { kanji: "太陽", kana: "タイヨウ" },
  { kanji: "みらい", kana: "ミライ" },
  { kanji: "北斗", kana: "ホクト" },
  { kanji: "白鳥", kana: "ハクチョウ" },
  { kanji: "常盤", kana: "トキワ" },
  { kanji: "扇", kana: "オウギ" },
  { kanji: "第一", kana: "ダイイチ" },
  { kanji: "中央", kana: "チュウオウ" },
  { kanji: "東和", kana: "トウワ" },
];

export interface IndustryProfile {
  industry: string;
  suffix: string;
}

export const INDUSTRY_PROFILES: IndustryProfile[] = [
  { industry: "卸売業", suffix: "商事" },
  { industry: "商社", suffix: "物産" },
  { industry: "製造業", suffix: "工業" },
  { industry: "食品製造業", suffix: "食品" },
  { industry: "運輸・物流業", suffix: "流通" },
  { industry: "運輸業", suffix: "運輸" },
  { industry: "建設資材卸売業", suffix: "建材" },
  { industry: "精密機械製造業", suffix: "精密" },
  { industry: "電子部品製造業", suffix: "電子" },
  { industry: "包装資材製造業", suffix: "包装" },
  { industry: "金属加工業", suffix: "金属加工" },
];

export interface CompanyName {
  kanji: string;
  kana: string;
  industry: string;
  emailLocalPart: string;
}

export function generateCompanyName(pickIndex: (max: number) => number): CompanyName {
  const prefix = COMPANY_PREFIXES[pickIndex(COMPANY_PREFIXES.length)];
  const stem = COMPANY_STEMS[pickIndex(COMPANY_STEMS.length)];
  const profile = INDUSTRY_PROFILES[pickIndex(INDUSTRY_PROFILES.length)];
  return {
    kanji: `${prefix}${stem.kanji}${profile.suffix}`,
    kana: `${stem.kana}${profile.suffix}`,
    industry: profile.industry,
    emailLocalPart: `keiri`,
  };
}
