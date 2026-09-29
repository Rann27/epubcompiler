import fs from "node:fs";
import path from "node:path";
import yazl from "yazl";
import type { BookSection, CompileRequest, CompileResult } from "../src/types/book.js";
import { generateContainerXml } from "./container.js";
import { collectEmbeddedFonts } from "./fonts.js";
import { generateCss } from "./generateCss.js";
import { generateNav } from "./generateNav.js";
import { generateOpf } from "./generateOpf.js";
import { collectTextColors, generateSectionXhtml } from "./generateXhtml.js";
import { processImages } from "./processImages.js";
import { sortByOrder } from "./utils.js";
import { normalizeSectionOrder, validateCompileRequest } from "./validate.js";

function addBuffer(zip: yazl.ZipFile, content: string | Buffer, metadataPath: string, compress = true) {
  zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"), metadataPath, { compress });
}

function writeZip(zip: yazl.ZipFile, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const stream = fs.createWriteStream(outputPath);
    zip.outputStream.pipe(stream);
    zip.outputStream.once("error", reject);
    stream.once("error", reject);
    stream.once("close", resolve);
    zip.end();
  });
}

export async function packageEpub(request: CompileRequest): Promise<CompileResult> {
  const errors = validateCompileRequest(request);
  if (errors.length > 0) throw new Error(errors[0]);

  const sections = normalizeSectionOrder(request.sections);
  const zip = new yazl.ZipFile();
  const images = await processImages(request.sourceDocx, sections, request.imageQuality);
  const fontEmbedding = collectEmbeddedFonts(sections);

  addBuffer(zip, "application/epub+zip", "mimetype", false);
  addBuffer(zip, generateContainerXml(), "META-INF/container.xml");
  addBuffer(
    zip,
    generateCss({
      fonts: fontEmbedding.fonts,
      bodyFamily: fontEmbedding.bodyFamily,
      headingFamily: fontEmbedding.headingFamily,
      textColors: collectTextColors(sections)
    }),
    "OEBPS/css/style.css"
  );
  addBuffer(zip, generateNav(sections), "OEBPS/nav.xhtml");
  addBuffer(zip, generateOpf(request.metadata, sections, fontEmbedding.fonts), "OEBPS/content.opf");

  for (const section of sortByOrder(sections).filter((item) => item.type !== "toc")) {
    addBuffer(zip, generateSectionXhtml(section), `OEBPS/${section.href}`);
  }

  for (const [name, buffer] of images) {
    addBuffer(zip, buffer, `OEBPS/images/${name}`);
  }

  for (const font of fontEmbedding.fonts) {
    addBuffer(zip, fs.readFileSync(font.sourcePath), `OEBPS/fonts/${font.outputName}`);
  }

  await writeZip(zip, request.outputPath);
  return {
    outputPath: request.outputPath,
    xhtmlCount: sections.filter((section) => section.includeInSpine || section.type === "toc").length,
    imageCount: images.size,
    tocItemCount: sections.filter((section) => section.includeInToc).length,
    fontStatus: fontEmbedding.statuses
  };
}

export function getCompileSummary(sections: BookSection[]) {
  return {
    xhtmlCount: sections.filter((section) => section.includeInSpine || section.type === "toc").length,
    imageCount: sections.filter((section) => section.image).length,
    tocItemCount: sections.filter((section) => section.includeInToc).length
  };
}
