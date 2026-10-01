import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { BookMetadata, BookSection, DocxBlock, ParsedDocx } from "../src/types/book.js";
import { epubText, normalizeLang } from "../src/i18n/epub.js";
import { imageOutputExtension, slugify, uniqueHref } from "./utils.js";

// A level-1 heading that is itself a table of contents (any supported language).
// The compiler generates its own nav page, so this one is a duplicate.
const TOC_HEADING = /^\s*(daftar\s+isi|table\s+of\s+contents|contents|toc)\s*$/i;

function sectionDefaults(type: BookSection["type"]) {
  return {
    includeInSpine: true,
    includeInToc: type !== "image",
    linear: true
  };
}

function makeSection(
  type: BookSection["type"],
  title: string,
  href: string,
  order: number,
  sourceBlocks: DocxBlock[] = [],
  extra: Partial<BookSection> = {}
): BookSection {
  return {
    id: type === "toc" ? "nav" : slugify(href.replace(/^xhtml\/|\.xhtml$/g, ""), `${type}-${order}`),
    type,
    title,
    href,
    sourceBlocks,
    order,
    ...sectionDefaults(type),
    ...extra
  };
}

export function createDefaultMetadata(parsed: ParsedDocx, language = "id"): BookMetadata {
  const baseTitle = path.basename(parsed.filename, path.extname(parsed.filename)).replace(/[_-]+/g, " ");
  const now = new Date();
  return {
    title: baseTitle,
    author: "",
    translator: "",
    publisher: "",
    language: normalizeLang(language),
    description: "",
    series: "",
    volume: "1",
    uuid: uuidv4(),
    date: now.toISOString().slice(0, 10),
    modified: now.toISOString().replace(/\.\d{3}Z$/, "Z")
  };
}

export function buildSections(parsed: ParsedDocx, language = "id"): BookSection[] {
  const text = epubText(language);
  const usedHrefs = new Set<string>();
  const firstHeadingIndex = parsed.blocks.findIndex((block) => block.type === "heading");
  const firstMainIndex = firstHeadingIndex === -1 ? parsed.blocks.length : firstHeadingIndex;
  const frontImageIndexes = new Set(
    parsed.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => block.type === "image" && index < firstMainIndex)
      .map(({ index }) => index)
  );
  const sections: BookSection[] = [];
  let order = 0;
  let imageNumber = 1;
  let chapterNumber = 1;
  let continuationNumber = 1;
  let current: BookSection | null = null;
  let currentTextType: BookSection["type"] = "extra";
  let currentTextTitle = text.frontMatter;
  let currentTextSlug = "front-matter";
  let currentTextInSpine = true;
  let textContextStarted = false;
  let tocInserted = false;
  let openerInserted = false;

  const addToc = () => {
    if (tocInserted) return;
    const tocSection = makeSection("toc", text.toc, "nav.xhtml", order++);
    tocSection.id = "nav";
    sections.push(tocSection);
    tocInserted = true;
  };

  const startTextSection = (type: BookSection["type"], title: string, fallback: string, includeInToc: boolean, initialBlocks: DocxBlock[] = [], includeInSpine = true) => {
    const href = uniqueHref(`xhtml/${slugify(title, fallback)}.xhtml`, usedHrefs);
    current = makeSection(type, title, href, order++, initialBlocks, { includeInToc, includeInSpine });
    sections.push(current);
    currentTextType = type;
    currentTextTitle = title;
    currentTextSlug = slugify(title, fallback);
    currentTextInSpine = includeInSpine;
    continuationNumber = 1;
    textContextStarted = true;
  };

  const startContinuation = () => {
    continuationNumber += 1;
    const href = uniqueHref(`xhtml/${currentTextSlug}-part-${String(continuationNumber).padStart(2, "0")}.xhtml`, usedHrefs);
    current = makeSection(currentTextType, currentTextTitle, href, order++, [], { includeInToc: false, includeInSpine: currentTextInSpine });
    sections.push(current);
  };

  for (const [blockIndex, block] of parsed.blocks.entries()) {
    if (block.type === "image") {
      const isFirstImage = imageNumber === 1;
      const isFrontIllustration = !isFirstImage && frontImageIndexes.has(blockIndex);
      const isMidChapter = !isFirstImage && !isFrontIllustration;

      const illustrationNumber = Math.max(imageNumber - 1, 1);
      const extension = imageOutputExtension(block.filename);
      const outputName = isFirstImage ? `cover${extension}` : `illustration-${String(illustrationNumber).padStart(3, "0")}${extension}`;

      if (isMidChapter) {
        // Embed mid-chapter illustrations into the current chapter section to avoid
        // creating orphan spine items that confuse ToC highlighting in readers.
        if (!current) {
          if (textContextStarted) startContinuation();
          else startTextSection("extra", text.frontMatter, "front-matter", true);
        }
        (current as unknown as BookSection).sourceBlocks.push({ ...block, outputName });
        current = null; // next text block starts a new chapter part
        imageNumber += 1;
        continue;
      }

      if (isFrontIllustration && !openerInserted) {
        sections.push(makeSection("illustration-opener", text.illustrations, uniqueHref("xhtml/illustrations.xhtml", usedHrefs), order++, [], { includeInToc: false }));
        openerInserted = true;
      }

      const title = isFirstImage ? text.cover : text.illustration(illustrationNumber);
      const href = uniqueHref(`xhtml/${isFirstImage ? "cover" : `illustration-${String(illustrationNumber).padStart(3, "0")}`}.xhtml`, usedHrefs);
      sections.push(
        makeSection(isFirstImage ? "cover" : "image", title, href, order++, [block], {
          includeInToc: isFirstImage,
          image: { sourcePath: block.filename, outputName, alt: title }
        })
      );
      imageNumber += 1;

      if (current) current = null;
      continue;
    }

    // Fallback for books that start with text (no cover image).
    if (!tocInserted && blockIndex >= firstMainIndex) addToc();

    if (block.type === "heading" && block.level === 1) {
      if (TOC_HEADING.test(block.text)) {
        // Keep the content available (re-enable it in Book Structure if wanted),
        // but off by default so the book doesn't end up with two tables of contents.
        startTextSection("extra", block.text, "table-of-contents", false, [block], false);
        continue;
      }
      const about = /about|credit|translator|info/i.test(block.text);
      const type: BookSection["type"] = about ? "about" : "chapter";
      const fallback = about ? "about" : `chapter-${String(chapterNumber).padStart(3, "0")}`;
      startTextSection(type, block.text, fallback, true, [block]);
      if (!about) chapterNumber += 1;
      continue;
    }
    if (!current) {
      if (textContextStarted) {
        startContinuation();
      } else {
        startTextSection("extra", text.frontMatter, "front-matter", true);
      }
    }
    if (!current) {
      throw new Error("No readable content was found in this DOCX.");
    }
    (current as BookSection).sourceBlocks.push(block);
  }

  addToc();
  return sections
    .filter((section) => section.type === "toc" || section.type === "illustration-opener" || section.image || section.sourceBlocks.length > 0)
    .map((section, index) => ({ ...section, order: index }));
}
