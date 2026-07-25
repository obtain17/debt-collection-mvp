import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

let cachedFontBytes: Buffer | undefined;

function loadFontBytes(): Buffer {
  if (!cachedFontBytes) {
    const fontPath = path.join(process.cwd(), "assets", "fonts", "NotoSansJP-VF.ttf");
    cachedFontBytes = fs.readFileSync(fontPath);
  }
  return cachedFontBytes;
}

export interface JapaneseDoc {
  doc: PDFDocument;
  font: PDFFont;
}

/**
 * pdf-lib's standard fonts have no Japanese glyphs, so every PDF in this app
 * embeds the bundled Noto Sans JP font (app/assets/fonts) via fontkit.
 */
export async function createJapaneseDoc(): Promise<JapaneseDoc> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // subset: true corrupts many kanji glyphs from this variable font (renders
  // blank) — confirmed by direct comparison. Full embedding is larger
  // (~5-6MB/doc) but renders correctly.
  const font = await doc.embedFont(loadFontBytes(), { subset: false });
  return { doc, font };
}
