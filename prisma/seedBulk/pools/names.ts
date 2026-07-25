export interface NamePart {
  kanji: string;
  kana: string;
  romaji: string;
}

export const SURNAMES: NamePart[] = [
  { kanji: "田中", kana: "タナカ", romaji: "tanaka" },
  { kanji: "佐藤", kana: "サトウ", romaji: "sato" },
  { kanji: "鈴木", kana: "スズキ", romaji: "suzuki" },
  { kanji: "高橋", kana: "タカハシ", romaji: "takahashi" },
  { kanji: "渡辺", kana: "ワタナベ", romaji: "watanabe" },
  { kanji: "伊藤", kana: "イトウ", romaji: "ito" },
  { kanji: "山本", kana: "ヤマモト", romaji: "yamamoto" },
  { kanji: "中村", kana: "ナカムラ", romaji: "nakamura" },
  { kanji: "小林", kana: "コバヤシ", romaji: "kobayashi" },
  { kanji: "加藤", kana: "カトウ", romaji: "kato" },
  { kanji: "吉田", kana: "ヨシダ", romaji: "yoshida" },
  { kanji: "山田", kana: "ヤマダ", romaji: "yamada" },
  { kanji: "佐々木", kana: "ササキ", romaji: "sasaki" },
  { kanji: "山口", kana: "ヤマグチ", romaji: "yamaguchi" },
  { kanji: "松本", kana: "マツモト", romaji: "matsumoto" },
  { kanji: "井上", kana: "イノウエ", romaji: "inoue" },
  { kanji: "木村", kana: "キムラ", romaji: "kimura" },
  { kanji: "林", kana: "ハヤシ", romaji: "hayashi" },
  { kanji: "斎藤", kana: "サイトウ", romaji: "saito" },
  { kanji: "清水", kana: "シミズ", romaji: "shimizu" },
  { kanji: "森田", kana: "モリタ", romaji: "morita" },
  { kanji: "橋本", kana: "ハシモト", romaji: "hashimoto" },
  { kanji: "石川", kana: "イシカワ", romaji: "ishikawa" },
  { kanji: "前田", kana: "マエダ", romaji: "maeda" },
  { kanji: "藤田", kana: "フジタ", romaji: "fujita" },
  { kanji: "後藤", kana: "ゴトウ", romaji: "goto" },
  { kanji: "岡田", kana: "オカダ", romaji: "okada" },
  { kanji: "長谷川", kana: "ハセガワ", romaji: "hasegawa" },
  { kanji: "村上", kana: "ムラカミ", romaji: "murakami" },
  { kanji: "近藤", kana: "コンドウ", romaji: "kondo" },
];

export const GIVEN_NAMES_MALE: NamePart[] = [
  { kanji: "一郎", kana: "イチロウ", romaji: "ichiro" },
  { kanji: "太郎", kana: "タロウ", romaji: "taro" },
  { kanji: "次郎", kana: "ジロウ", romaji: "jiro" },
  { kanji: "健太", kana: "ケンタ", romaji: "kenta" },
  { kanji: "大輔", kana: "ダイスケ", romaji: "daisuke" },
  { kanji: "修", kana: "オサム", romaji: "osamu" },
  { kanji: "隆", kana: "タカシ", romaji: "takashi" },
  { kanji: "健二", kana: "ケンジ", romaji: "kenji" },
  { kanji: "真一", kana: "シンイチ", romaji: "shinichi" },
  { kanji: "浩二", kana: "コウジ", romaji: "koji" },
  { kanji: "誠", kana: "マコト", romaji: "makoto" },
  { kanji: "亮", kana: "リョウ", romaji: "ryo" },
  { kanji: "拓也", kana: "タクヤ", romaji: "takuya" },
  { kanji: "直樹", kana: "ナオキ", romaji: "naoki" },
  { kanji: "俊介", kana: "シュンスケ", romaji: "shunsuke" },
];

export const GIVEN_NAMES_FEMALE: NamePart[] = [
  { kanji: "花子", kana: "ハナコ", romaji: "hanako" },
  { kanji: "美咲", kana: "ミサキ", romaji: "misaki" },
  { kanji: "さくら", kana: "サクラ", romaji: "sakura" },
  { kanji: "由紀", kana: "ユキ", romaji: "yuki" },
  { kanji: "真由美", kana: "マユミ", romaji: "mayumi" },
  { kanji: "陽子", kana: "ヨウコ", romaji: "yoko" },
  { kanji: "彩", kana: "アヤ", romaji: "aya" },
  { kanji: "愛子", kana: "アイコ", romaji: "aiko" },
  { kanji: "由美", kana: "ユミ", romaji: "yumi" },
  { kanji: "恵美", kana: "エミ", romaji: "emi" },
  { kanji: "麻衣", kana: "マイ", romaji: "mai" },
  { kanji: "久美子", kana: "クミコ", romaji: "kumiko" },
  { kanji: "友子", kana: "トモコ", romaji: "tomoko" },
  { kanji: "直美", kana: "ナオミ", romaji: "naomi" },
];

export interface IndividualName {
  kanji: string;
  kana: string;
  emailLocalPart: string;
}

/** Combines a random surname + given name; deterministic given a pre-seeded RNG source. */
export function generateIndividualName(pickIndex: (max: number) => number): IndividualName {
  const surname = SURNAMES[pickIndex(SURNAMES.length)];
  const useMale = pickIndex(2) === 0;
  const givenPool = useMale ? GIVEN_NAMES_MALE : GIVEN_NAMES_FEMALE;
  const given = givenPool[pickIndex(givenPool.length)];
  return {
    kanji: `${surname.kanji}${given.kanji}`,
    kana: `${surname.kana}${given.kana}`,
    emailLocalPart: `${surname.romaji}.${given.romaji}`,
  };
}
