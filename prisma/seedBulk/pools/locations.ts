export interface LocationSample {
  prefecture: string;
  city: string;
}

export const LOCATIONS: LocationSample[] = [
  { prefecture: "東京都", city: "大田区蒲田" },
  { prefecture: "東京都", city: "品川区" },
  { prefecture: "東京都", city: "大田区西蒲田" },
  { prefecture: "東京都", city: "大田区東蒲田" },
  { prefecture: "東京都", city: "大田区南蒲田" },
  { prefecture: "東京都", city: "大田区下丸子" },
  { prefecture: "東京都", city: "大田区久が原" },
  { prefecture: "東京都", city: "大田区千鳥" },
  { prefecture: "東京都", city: "大田区羽田" },
  { prefecture: "東京都", city: "大田区大森" },
  { prefecture: "東京都", city: "大田区京浜島" },
  { prefecture: "東京都", city: "港区芝" },
  { prefecture: "東京都", city: "江東区豊洲" },
  { prefecture: "東京都", city: "足立区" },
  { prefecture: "東京都", city: "墨田区" },
  { prefecture: "東京都", city: "北区" },
  { prefecture: "東京都", city: "荒川区" },
  { prefecture: "東京都", city: "江戸川区" },
  { prefecture: "東京都", city: "板橋区" },
  { prefecture: "神奈川県", city: "横浜市西区" },
  { prefecture: "神奈川県", city: "横浜市鶴見区" },
  { prefecture: "神奈川県", city: "川崎市中原区" },
  { prefecture: "埼玉県", city: "川口市" },
  { prefecture: "千葉県", city: "船橋市" },
  { prefecture: "千葉県", city: "市川市" },
];

export function pickAddress(pickIndex: (max: number) => number, chome: number, banchi: number, go: number): string {
  const loc = LOCATIONS[pickIndex(LOCATIONS.length)];
  return `${loc.prefecture}${loc.city}${chome}-${banchi}-${go}`;
}
