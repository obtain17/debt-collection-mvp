import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { rgb, type PDFFont, type PDFPage, type PDFDocument } from "pdf-lib";
import { createJapaneseDoc } from "../lib/pdf/createJapaneseDoc";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_SIZE = 10.5;

// Color palette (Tailwind-inspired: navy/blue accent, amber for callouts)
const NAVY = rgb(0.059, 0.09, 0.165); // slate-900
const BLUE = rgb(0.145, 0.388, 0.922); // blue-600
const BLUE_DARK = rgb(0.114, 0.306, 0.847); // blue-700
const BLUE_LIGHT = rgb(0.918, 0.945, 0.996); // blue-50/100 blend
const COVER_SUBTITLE = rgb(0.75, 0.82, 0.98);
const COVER_DATE = rgb(0.65, 0.74, 0.96);
const SLATE_TEXT = rgb(0.2, 0.255, 0.333); // slate-700
const SLATE_MUTED = rgb(0.392, 0.455, 0.545); // slate-500
const AMBER_BG = rgb(1, 0.973, 0.878); // amber-50
const AMBER_BORDER = rgb(0.984, 0.749, 0.141); // amber-400
const AMBER_TEXT = rgb(0.573, 0.251, 0.055); // amber-800
const WHITE = rgb(1, 1, 1);

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const test = current + ch;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN_TOP;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    newPage(ctx);
  }
}

function rawLine(ctx: Ctx, text: string, size: number, indent = 0, color = SLATE_TEXT): void {
  ensureSpace(ctx, size + 6);
  ctx.page.drawText(text, { x: MARGIN_X + indent, y: ctx.y, size, font: ctx.font, color });
  ctx.y -= size + 6;
}

function drawCover(ctx: Ctx, dateStr: string): void {
  const bandHeight = 156;
  ctx.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bandHeight, width: PAGE_WIDTH, height: bandHeight, color: NAVY });
  ctx.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bandHeight, width: 6, height: bandHeight, color: BLUE });
  ctx.page.drawText("AI債権回収プラットフォーム", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 72,
    size: 22,
    font: ctx.font,
    color: WHITE,
  });
  ctx.page.drawText("利用ガイド", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 104,
    size: 16,
    font: ctx.font,
    color: COVER_SUBTITLE,
  });
  ctx.page.drawText(`作成日: ${dateStr}`, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 132,
    size: 10,
    font: ctx.font,
    color: COVER_DATE,
  });
  ctx.y = PAGE_HEIGHT - bandHeight - 26;
}

let sectionCounter = 0;

function h1(ctx: Ctx, text: string, numbered = true): void {
  ctx.y -= 14;
  const bandHeight = 32;
  ensureSpace(ctx, bandHeight + 16);
  const bandBottom = ctx.y - bandHeight;

  ctx.page.drawRectangle({
    x: MARGIN_X - 12,
    y: bandBottom,
    width: CONTENT_WIDTH + 24,
    height: bandHeight,
    color: BLUE_LIGHT,
  });
  ctx.page.drawRectangle({ x: MARGIN_X - 12, y: bandBottom, width: 4, height: bandHeight, color: BLUE });

  let textX = MARGIN_X + 6;
  if (numbered) {
    sectionCounter += 1;
    const cx = MARGIN_X + 20;
    const cy = bandBottom + bandHeight / 2;
    ctx.page.drawEllipse({ x: cx, y: cy, xScale: 11, yScale: 11, color: BLUE });
    const numStr = String(sectionCounter);
    const numWidth = ctx.font.widthOfTextAtSize(numStr, 11);
    ctx.page.drawText(numStr, { x: cx - numWidth / 2, y: cy - 4, size: 11, font: ctx.font, color: WHITE });
    textX = MARGIN_X + 42;
  }

  ctx.page.drawText(text, {
    x: textX,
    y: bandBottom + bandHeight / 2 - 5,
    size: 13,
    font: ctx.font,
    color: NAVY,
  });
  ctx.y = bandBottom - 16;
}

function h2(ctx: Ctx, text: string): void {
  ctx.y -= 4;
  ensureSpace(ctx, 20);
  ctx.page.drawRectangle({ x: MARGIN_X, y: ctx.y - 9, width: 3, height: 13, color: BLUE });
  ctx.page.drawText(text, { x: MARGIN_X + 10, y: ctx.y - 4, size: 12, font: ctx.font, color: BLUE_DARK });
  ctx.y -= 12 + 8;
}

function paragraph(ctx: Ctx, text: string, indent = 0): void {
  for (const line of wrapText(ctx.font, text, BODY_SIZE, CONTENT_WIDTH - indent)) {
    rawLine(ctx, line, BODY_SIZE, indent, SLATE_TEXT);
  }
}

function bullet(ctx: Ctx, text: string): void {
  const lines = wrapText(ctx.font, text, BODY_SIZE, CONTENT_WIDTH - 18);
  lines.forEach((line, i) => {
    ensureSpace(ctx, BODY_SIZE + 6);
    if (i === 0) {
      ctx.page.drawEllipse({
        x: MARGIN_X + 4,
        y: ctx.y + BODY_SIZE * 0.32,
        xScale: 2.3,
        yScale: 2.3,
        color: BLUE,
      });
    }
    ctx.page.drawText(line, { x: MARGIN_X + 12, y: ctx.y, size: BODY_SIZE, font: ctx.font, color: SLATE_TEXT });
    ctx.y -= BODY_SIZE + 6;
  });
}

function note(ctx: Ctx, text: string): void {
  const size = 9;
  const lineHeight = size + 5;
  const lines = wrapText(ctx.font, text, size, CONTENT_WIDTH - 28);
  const boxHeight = lines.length * lineHeight + 14;
  ensureSpace(ctx, boxHeight + 8);

  const boxTop = ctx.y + 6;
  const boxBottom = boxTop - boxHeight;
  ctx.page.drawRectangle({ x: MARGIN_X, y: boxBottom, width: CONTENT_WIDTH, height: boxHeight, color: AMBER_BG });
  ctx.page.drawRectangle({ x: MARGIN_X, y: boxBottom, width: 3, height: boxHeight, color: AMBER_BORDER });

  let ly = boxTop - 12;
  for (const line of lines) {
    ctx.page.drawText(line, { x: MARGIN_X + 14, y: ly, size, font: ctx.font, color: AMBER_TEXT });
    ly -= lineHeight;
  }
  ctx.y = boxBottom - 10;
}

function spacer(ctx: Ctx, amount = 6): void {
  ctx.y -= amount;
}

function drawFooters(doc: PDFDocument, font: PDFFont): void {
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (i === 0) return; // cover page has its own band, skip footer clutter
    const pageText = `${i + 1} / ${pages.length}`;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 8);
    p.drawLine({
      start: { x: MARGIN_X, y: 42 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 42 },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
    p.drawText("AI債権回収プラットフォーム 利用ガイド", { x: MARGIN_X, y: 28, size: 8, font, color: SLATE_MUTED });
    p.drawText(pageText, {
      x: PAGE_WIDTH - MARGIN_X - pageTextWidth,
      y: 28,
      size: 8,
      font,
      color: SLATE_MUTED,
    });
  });
}

async function main() {
  const { doc, font } = await createJapaneseDoc();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: Ctx = { doc, font, page, y: PAGE_HEIGHT - MARGIN_TOP };

  drawCover(ctx, new Date().toLocaleDateString("ja-JP"));

  h1(ctx, "このシステムについて", false);
  paragraph(
    ctx,
    "本システムは、銀行・信用金庫・事業会社・サービサー等のクライアント組織のスタッフが、AIによる債権分析・" +
      "自動督促・デジタル交渉ポータルを使って債権管理業務を効率化するためのSaaSです。",
  );
  paragraph(
    ctx,
    "本システムは「クライアント組織自身のスタッフが使う督促・交渉支援ツール」であり、当社が代理で債権回収を" +
      "行うものではありません。督促メール・郵便等の送信者名は常にクライアント組織名で表示され、AIの分析結果は" +
      "あくまで「提示」であり、断定的な回収宣言や法的助言は行いません。",
  );

  h1(ctx, "ログイン方法", false);
  paragraph(ctx, "ブラウザで以下のURLを開き、デモアカウントでログインしてください(全員共通パスワード: demo1234)。");
  paragraph(ctx, "URL: http://localhost:3000");
  spacer(ctx, 4);
  bullet(ctx, "デモ信用金庫 / yamada.taro@demo-shinkin.example / 管理者");
  bullet(ctx, "デモ信用金庫 / sato.hanako@demo-shinkin.example / 担当者");
  bullet(ctx, "デモ信用金庫 / suzuki.ichiro@demo-shinkin.example / 担当者");
  bullet(ctx, "デモ商事株式会社 / takahashi.kenji@demo-shoji.example / 管理者");
  bullet(ctx, "デモ商事株式会社 / ito.yuki@demo-shoji.example / 担当者");
  note(ctx, "「管理者」はコンプライアンスフラグの解除・督促文面の承認・各種設定画面の利用ができます。");

  h1(ctx, "画面構成(上部メニュー)", false);
  bullet(ctx, "ダッシュボード: 自組織の債権ケース一覧");
  bullet(ctx, "TODO: 本日対応すべき案件の一覧");
  bullet(ctx, "入金: 入金の取込・照合・履歴確認");
  bullet(ctx, "レポート: 回収率・ステータス・AIリスクの集計");
  bullet(ctx, "設定(管理者のみ): 督促ルール・文面テンプレート・交渉条件ルール");

  h1(ctx, "ダッシュボード");
  paragraph(ctx, "自組織の債権ケースを一覧表示します。ステータス・AIリスクで絞り込み、残高や延滞日数で並び替えできます。");
  paragraph(ctx, "債務者名をクリックするとケース詳細画面に遷移します。");

  h1(ctx, "ケース詳細画面");
  paragraph(ctx, "1件の債権について、台帳情報からAI分析・督促・交渉・入金までをすべて確認・操作できる画面です。");

  h2(ctx, "台帳情報(債権情報・債務者情報)");
  paragraph(
    ctx,
    "原債権者・現在の債権者・債権譲渡日・元本/利息/遅延損害金の内訳・契約日・消滅時効管理日・判決等の有無・" +
      "保証人の有無、債務者の連絡先・勤務先・本人確認状況などを表示します。",
  );

  h2(ctx, "AI分析");
  paragraph(
    ctx,
    "リスク区分・回収可能性(何日以内に入金される確率か)・想定回収額・信頼度・前回スコアとの差分に加えて、" +
      "本人接触可能性/支払意思/支払能力/回収経済性の4指標、AIが推奨する複数の行動案を表示します。" +
      "「AI分析を再実行」ボタンでいつでも再分析できます。",
  );
  note(ctx, "ANTHROPIC_API_KEY が未設定の環境では「未分析」と表示されます。");

  h2(ctx, "コンプライアンスフラグ");
  paragraph(
    ctx,
    "弁護士受任通知・破産手続中・苦情対応中など、自動督促を止めるべき事情をフラグとして設定できます。" +
      "フラグが立っている間は、該当するチャネルの自動送信がすべてスキップされます。解除は管理者のみ可能です。",
  );

  h2(ctx, "接触記録・入金記録の追加");
  paragraph(ctx, "電話発信・不通・本人と通話・折返し・支払約束(不履行)などの接触結果や、入金を手動で記録できます。");

  h2(ctx, "接触回数・時間帯");
  paragraph(
    ctx,
    "本日/今週の架電・SMS回数と次回連絡可能日時を表示します。1日1回・週3回等の上限を超える場合や、" +
      "営業時間外(08:00〜20:00)は自動送信がスキップされます。",
  );

  h2(ctx, "返済提案");
  paragraph(
    ctx,
    "債務者からポータル経由で提出された分割・一括和解の提案を確認し、承認/却下できます。減額率等をもとに" +
      "「社内ルール内」「上長承認必要」「法務承認必要」「提示不可」の判定が自動表示されます" +
      "(最終判断はスタッフに委ねられます)。月収・家賃等の財務情報が入力されていれば併せて表示します。",
  );

  h2(ctx, "督促スケジュール");
  paragraph(
    ctx,
    "強めの通知(督促強化・最終通告)や郵送は、送信前に管理者の承認が必要です。文面の編集・禁止表現の" +
      "チェック・法務確認済みテンプレートの確認・郵便種別(普通/書留)の選択を行った上で承認・却下します。" +
      "友好的なリマインド(メール/SMS)は引き続き自動送信されます。",
  );

  h2(ctx, "返済予定");
  paragraph(
    ctx,
    "返済合意が成立した案件について、今月の予定額・入金額・未入金額・次回支払日・遅延日数・約束履行率・" +
      "連続支払回数・延滞回数・完済予定日を表示します。",
  );

  h2(ctx, "合意書・完済証明書のダウンロード");
  paragraph(
    ctx,
    "債務者がポータルで電子同意すると合意書(PDF)がダウンロードできるようになります。完済した案件は" +
      "完済証明書(PDF)をダウンロードできます。",
  );

  h2(ctx, "交渉ポータルのリンク発行");
  paragraph(ctx, "債務者専用の交渉ポータルURL(マジックリンク)を発行・再発行できます。");

  h1(ctx, "TODOダッシュボード");
  paragraph(ctx, "その日に対応すべき案件を以下の観点で一覧表示します。");
  bullet(ctx, "本日の架電予定 / 本日の支払期限");
  bullet(ctx, "約束不履行案件 / 折返し依頼案件");
  bullet(ctx, "上長承認待ち(返済提案)");
  bullet(ctx, "郵便返送案件 / SMS不達案件");
  bullet(ctx, "新規入金案件 / 苦情・緊急対応案件");
  bullet(ctx, "時効期限接近案件 / 弁護士移管候補");
  bullet(ctx, "長期間対応されていない案件");

  h1(ctx, "入金管理");
  paragraph(
    ctx,
    "通帳や銀行明細のスクリーンショット・写真をアップロードすると、AIが入金行(日付・金額・振込人名義)を" +
      "自動抽出し、仮想口座番号または振込人名義から該当案件に自動でマッチングします。金額に応じて一部入金・" +
      "過入金も自動判定されます。1件ずつの手動入力にも対応しています。",
  );
  paragraph(ctx, "自動でマッチングできなかった入金は「未処理入金」に残り、案件を選んで手動で割り当てられます。");
  paragraph(ctx, "誤って記録した入金は「取消」で取り消せます(残高・完済ステータスは自動的に元に戻ります)。");

  h1(ctx, "レポート");
  paragraph(ctx, "回収率・元本合計・回収済合計、ステータス別の件数(ファネル)、AIリスク分布を確認できます。");

  h1(ctx, "設定(管理者専用)");
  h2(ctx, "自動督促の設定");
  paragraph(ctx, "督促シナリオの各ステップ(経過日数・チャネル・トーン・テンプレート)を追加・削除できます。");
  h2(ctx, "文面テンプレート");
  paragraph(
    ctx,
    "督促文面をテンプレートとして作成・編集し、法務確認済みかどうかを管理できます。既存のステップと同じ" +
      "キーで作成すると、その文面が優先的に使われます。",
  );
  h2(ctx, "交渉条件ルール");
  paragraph(
    ctx,
    "元本減額・利息免除の可否、最大減額率、上長/法務承認が必要になる減額率のしきい値、最大分割回数、" +
      "最低月額などを設定できます。",
  );

  h1(ctx, "交渉ポータル(債務者向け画面)");
  paragraph(ctx, "督促メール・SMS内のリンクから、債務者がスマートフォン等で開く専用ページです。");
  paragraph(
    ctx,
    "初回アクセス時は本人確認が完了するまで残高・提案内容等は一切表示されません" +
      "(第三者への情報開示を防ぐための本人確認機能)。電話番号の下4桁・生年月日・照会番号・秘密の質問・" +
      "ワンタイムコードのいずれかで確認すると、以後は同じリンクで再確認不要になります。5回連続で確認に失敗" +
      "すると、そのリンクはロックされ担当者への問い合わせが必要になります。",
  );
  bullet(ctx, "現在の残高・状況の確認(本人確認後)");
  bullet(ctx, "分割払い(3/6/12/24回)または一括和解の提案");
  bullet(ctx, "月収・家賃等の返済状況の任意入力");
  bullet(ctx, "承認された提案への電子同意(氏名入力+同意チェック)");
  bullet(ctx, "合意書(PDF)のダウンロード");

  h1(ctx, "架電・SMS時の本人確認(スタッフ向け)");
  paragraph(
    ctx,
    "電話やSMSでのやり取りはスタッフ(人間)が行うため、システムが自動で確認することはできません。" +
      "ケース詳細画面の「本人確認情報の設定」に、電話をかける前に確認すべき項目(照会番号・登録電話番号の" +
      "下4桁・生年月日・秘密の質問)がヒントとして表示されます。本人確認が取れるまでは、債権額や具体的な" +
      "内容を相手に開示しないようにしてください。",
  );

  h1(ctx, "MVPとしての注意事項", false);
  bullet(ctx, "SMS・郵送・電話(AI音声/オペレーター)は実際には送信されません(記録・シミュレートのみ)。実送信されるのはメールのみです。");
  bullet(ctx, "ANTHROPIC_API_KEY が未設定の場合、AI分析・入金画像取込は利用できません。");
  bullet(ctx, "元本・利息・遅延損害金の充当は表示・記録用の簡易計算であり、正式な会計処理ではありません。");

  drawFooters(doc, font);

  const bytes = await doc.save();
  const outputDir = path.join(process.cwd(), "..", "output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "利用ガイド.pdf");
  fs.writeFileSync(outputPath, bytes);
  console.log(`Saved: ${outputPath} (${bytes.length} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
