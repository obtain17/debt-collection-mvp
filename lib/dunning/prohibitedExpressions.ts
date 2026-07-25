/**
 * Illustrative list of coercive/threatening phrasing patterns that Japanese
 * debt-collection compliance (Servicer Law / Money Lending Business Act
 * guidance) treats as red flags. Not a legal reference — a starting point for
 * the send-time guard, to be maintained by the client's legal team in a real
 * deployment.
 */
const PROHIBITED_PHRASES = [
  "必ず耐えられなくなる",
  "自宅を差し押さえる",
  "会社に連絡する",
  "家族に知らせる",
  "夜間に訪問する",
  "今日中に払わないと",
  "裁判にする",
  "財産を没収する",
];

export function checkProhibitedExpressions(text: string): string[] {
  return PROHIBITED_PHRASES.filter((phrase) => text.includes(phrase));
}
