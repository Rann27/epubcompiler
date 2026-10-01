import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import type { DocxBlock, DocxRun, ParsedDocx, TextAlign } from "../src/types/book.js";
import { normalizeHexColor, normalizeZipPath } from "./utils.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  removeNSPrefix: false,
  parseTagValue: false,
  trimValues: false
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textFromNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    return Object.entries(record)
      .filter(([key]) => key !== "@_xml:space" && !key.startsWith("@_"))
      .map(([, value]) => textFromNode(value))
      .join("");
  }
  return "";
}

function findRelationshipIds(node: unknown, ids = new Set<string>()): Set<string> {
  if (node == null) return ids;
  if (Array.isArray(node)) {
    node.forEach((item) => findRelationshipIds(item, ids));
    return ids;
  }
  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if ((key === "@_r:embed" || key === "@_r:link" || key === "@_r:id") && typeof value === "string") {
        ids.add(value);
      }
      findRelationshipIds(value, ids);
    }
  }
  return ids;
}

function getHeadingLevel(paragraph: Record<string, unknown>): number | null {
  const style =
    (paragraph["w:pPr"] as Record<string, unknown> | undefined)?.["w:pStyle"] as
      | Record<string, unknown>
      | undefined;
  const value = style?.["@_w:val"];
  if (typeof value !== "string") return null;
  const match = value.match(/Heading(\d+)|heading\s*(\d+)|Title(\d+)/i);
  if (!match) return null;
  return Number(match[1] ?? match[2] ?? match[3] ?? 1);
}

function getParagraphStyleId(paragraph: Record<string, unknown>): string | undefined {
  const style =
    (paragraph["w:pPr"] as Record<string, unknown> | undefined)?.["w:pStyle"] as
      | Record<string, unknown>
      | undefined;
  const value = style?.["@_w:val"];
  return typeof value === "string" ? value : undefined;
}

function getRunFont(run: unknown): string | undefined {
  const runRecord = Array.isArray(run) ? (run[0] as Record<string, unknown> | undefined) : (run as Record<string, unknown> | undefined);
  const fonts = (runRecord?.["w:rPr"] as Record<string, unknown> | undefined)?.["w:rFonts"] as
    | Record<string, unknown>
    | undefined;
  const value = fonts?.["@_w:ascii"] ?? fonts?.["@_w:hAnsi"] ?? fonts?.["@_w:cs"] ?? fonts?.["@_w:eastAsia"];
  return typeof value === "string" ? value : undefined;
}

function getStyleFont(styles: Record<string, any>, styleId: string | undefined): string | undefined {
  if (!styleId) return undefined;
  const style = asArray<Record<string, any>>(styles["w:styles"]?.["w:style"]).find((item) => item?.["@_w:styleId"] === styleId);
  const fonts = style?.["w:rPr"]?.["w:rFonts"];
  const value = fonts?.["@_w:ascii"] ?? fonts?.["@_w:hAnsi"] ?? fonts?.["@_w:cs"] ?? fonts?.["@_w:eastAsia"];
  return typeof value === "string" ? value : undefined;
}

function getDefaultFont(styles: Record<string, any>): string | undefined {
  const fonts = styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"]?.["w:rFonts"];
  const value = fonts?.["@_w:ascii"] ?? fonts?.["@_w:hAnsi"] ?? fonts?.["@_w:cs"] ?? fonts?.["@_w:eastAsia"];
  return typeof value === "string" ? value : undefined;
}

function getNormalStyleFont(styles: Record<string, any>): string | undefined {
  const normalStyle = asArray<Record<string, any>>(styles["w:styles"]?.["w:style"]).find(
    (item) => item?.["@_w:styleId"] === "Normal" || item?.["w:name"]?.["@_w:val"] === "Normal"
  );
  const fonts = normalStyle?.["w:rPr"]?.["w:rFonts"];
  const value = fonts?.["@_w:ascii"] ?? fonts?.["@_w:hAnsi"] ?? fonts?.["@_w:cs"] ?? fonts?.["@_w:eastAsia"];
  return typeof value === "string" ? value : undefined;
}

function colorFromRpr(rPr: unknown): string | undefined {
  const color = (rPr as Record<string, unknown> | undefined)?.["w:color"] as Record<string, unknown> | undefined;
  return normalizeHexColor(color?.["@_w:val"]);
}

function getRunColor(run: Record<string, unknown> | undefined): string | undefined {
  return colorFromRpr(run?.["w:rPr"]);
}

function getParagraphMarkColor(paragraph: Record<string, unknown>): string | undefined {
  const pPr = paragraph["w:pPr"] as Record<string, unknown> | undefined;
  return colorFromRpr(pPr?.["w:rPr"]);
}

function findStyleRpr(styles: Record<string, any>, styleId: string | undefined): unknown {
  if (!styleId) return undefined;
  const style = asArray<Record<string, any>>(styles["w:styles"]?.["w:style"]).find((item) => item?.["@_w:styleId"] === styleId);
  return style?.["w:rPr"];
}

function getStyleColor(styles: Record<string, any>, styleId: string | undefined): string | undefined {
  return colorFromRpr(findStyleRpr(styles, styleId));
}

type RunFormatting = { bold?: boolean; italic?: boolean; underline?: boolean };

// Word's on/off properties: a bare <w:b/> means on, while w:val="0"/"false"/"off"
// turns an inherited property back off. Underline additionally uses "none" for off
// and any other value ("single", "wave", ...) for on. Returns undefined when the
// property is absent, so the next layer of the inheritance chain gets a say.
function toggleValue(node: unknown): boolean | undefined {
  if (node === undefined || node === null) return undefined;
  const value = (node as Record<string, unknown>)?.["@_w:val"];
  if (value === undefined) return true;
  const raw = String(value).trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "off" || raw === "none");
}

function formattingFromRpr(rPr: unknown): RunFormatting {
  const record = rPr as Record<string, unknown> | undefined;
  if (!record) return {};
  return {
    bold: toggleValue(record["w:b"]),
    italic: toggleValue(record["w:i"]),
    underline: toggleValue(record["w:u"])
  };
}

// First layer that actually specifies a property wins, mirroring how Word resolves
// direct formatting over character style over paragraph style over document defaults.
function mergeFormatting(...layers: RunFormatting[]): RunFormatting {
  const result: RunFormatting = {};
  for (const key of ["bold", "italic", "underline"] as const) {
    for (const layer of layers) {
      if (layer[key] !== undefined) {
        result[key] = layer[key];
        break;
      }
    }
  }
  return result;
}

function getRunStyleId(run: Record<string, unknown> | undefined): string | undefined {
  const style = (run?.["w:rPr"] as Record<string, unknown> | undefined)?.["w:rStyle"] as Record<string, unknown> | undefined;
  const value = style?.["@_w:val"];
  return typeof value === "string" ? value : undefined;
}

function sameFormatting(a: DocxRun, b: DocxRun): boolean {
  return (
    a.color === b.color &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize
  );
}

// The color everything inherits when nothing overrides it. Runs matching this are
// left unstyled so ordinary text does not get wrapped in redundant markup.
function getDefaultColor(styles: Record<string, any>): string {
  const normalStyle = asArray<Record<string, any>>(styles["w:styles"]?.["w:style"]).find(
    (item) => item?.["@_w:styleId"] === "Normal" || item?.["w:name"]?.["@_w:val"] === "Normal"
  );
  return (
    colorFromRpr(normalStyle?.["w:rPr"]) ??
    colorFromRpr(styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"]) ??
    "000000"
  );
}

// Collapses whitespace across the whole paragraph exactly as a single
// `text.replace(/\s+/g, " ").trim()` would, while keeping run boundaries intact.
// Adjacent runs sharing identical formatting are merged so one styled phrase
// becomes one element rather than a chain of them.
function collapseRuns(raw: DocxRun[]): DocxRun[] {
  const out: DocxRun[] = [];
  let pendingSpace = false;
  let started = false;

  for (const run of raw) {
    let value = "";
    for (const char of run.text) {
      if (/\s/.test(char)) {
        if (started) pendingSpace = true;
        continue;
      }
      if (pendingSpace) {
        value += " ";
        pendingSpace = false;
      }
      value += char;
      started = true;
    }
    if (!value) continue;
    const previous = out[out.length - 1];
    if (previous && sameFormatting(previous, run)) previous.text += value;
    else out.push({ ...run, text: value });
  }

  return out;
}

// --- Style inheritance -------------------------------------------------------
// Fonts, sizes, alignment and hyphenation are resolved the way Word does: direct
// formatting, then the style and its basedOn ancestors, then document defaults.

type StyleIndex = { byId: Map<string, Record<string, any>>; defaultParagraphId?: string };
type ThemeFonts = { major?: string; minor?: string };

function buildStyleIndex(styles: Record<string, any>): StyleIndex {
  const byId = new Map<string, Record<string, any>>();
  let defaultParagraphId: string | undefined;
  for (const style of asArray<Record<string, any>>(styles["w:styles"]?.["w:style"])) {
    const id = style?.["@_w:styleId"];
    if (typeof id !== "string") continue;
    byId.set(id, style);
    if (style["@_w:type"] === "paragraph" && String(style["@_w:default"]) === "1") defaultParagraphId = id;
  }
  return { byId, defaultParagraphId };
}

// Style first, then each basedOn ancestor. A paragraph with no explicit style
// uses the document's default paragraph style.
function styleChain(index: StyleIndex, styleId: string | undefined, useDefault: boolean): Record<string, any>[] {
  const chain: Record<string, any>[] = [];
  const seen = new Set<string>();
  let id = styleId ?? (useDefault ? index.defaultParagraphId : undefined);
  while (id && !seen.has(id)) {
    seen.add(id);
    const style = index.byId.get(id);
    if (!style) break;
    chain.push(style);
    const parent = style["w:basedOn"]?.["@_w:val"];
    id = typeof parent === "string" ? parent : undefined;
  }
  return chain;
}

function readTheme(zip: AdmZip): ThemeFonts {
  const entry = zip.getEntry("word/theme/theme1.xml");
  if (!entry) return {};
  try {
    const theme = parser.parse(entry.getData().toString("utf8")) as Record<string, any>;
    const scheme = theme["a:theme"]?.["a:themeElements"]?.["a:fontScheme"];
    const face = (node: any) => (typeof node?.["a:latin"]?.["@_typeface"] === "string" ? node["a:latin"]["@_typeface"] : undefined);
    return { major: face(scheme?.["a:majorFont"]), minor: face(scheme?.["a:minorFont"]) };
  } catch {
    return {};
  }
}

function readAutoHyphenation(zip: AdmZip): boolean {
  const entry = zip.getEntry("word/settings.xml");
  if (!entry) return false;
  const settings = parser.parse(entry.getData().toString("utf8")) as Record<string, any>;
  return toggleValue(settings["w:settings"]?.["w:autoHyphenation"]) ?? false;
}

function latinFontFrom(rFonts: Record<string, any> | undefined, theme: ThemeFonts): string | undefined {
  if (!rFonts) return undefined;
  const direct = rFonts["@_w:ascii"] ?? rFonts["@_w:hAnsi"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const themed = rFonts["@_w:asciiTheme"] ?? rFonts["@_w:hAnsiTheme"];
  if (typeof themed !== "string") return undefined;
  if (/^major/i.test(themed)) return theme.major;
  if (/^minor/i.test(themed)) return theme.minor;
  return undefined;
}

function resolveFontFamily(layers: unknown[], theme: ThemeFonts): string | undefined {
  for (const layer of layers) {
    const font = latinFontFrom((layer as Record<string, any> | undefined)?.["w:rFonts"], theme);
    if (font) return font;
  }
  return undefined;
}

function resolveFontSize(layers: unknown[]): number | undefined {
  for (const layer of layers) {
    const raw = (layer as Record<string, any> | undefined)?.["w:sz"]?.["@_w:val"];
    const halfPoints = Number(raw);
    if (Number.isFinite(halfPoints) && halfPoints > 0) return halfPoints / 2;
  }
  return undefined;
}

function resolveAlign(layers: unknown[]): TextAlign | undefined {
  for (const layer of layers) {
    const raw = (layer as Record<string, any> | undefined)?.["w:jc"]?.["@_w:val"];
    if (typeof raw !== "string") continue;
    if (raw === "both" || raw === "distribute" || raw === "thaiDistribute" || raw === "lowKashida" || raw === "mediumKashida" || raw === "highKashida") return "justify";
    if (raw === "center") return "center";
    if (raw === "right" || raw === "end") return "right";
    if (raw === "left" || raw === "start") return "left";
  }
  return undefined;
}

function resolveSuppressHyphens(layers: unknown[]): boolean {
  for (const layer of layers) {
    const value = toggleValue((layer as Record<string, any> | undefined)?.["w:suppressAutoHyphens"]);
    if (value !== undefined) return value;
  }
  return false;
}

type ParagraphContext = {
  index: StyleIndex;
  theme: ThemeFonts;
  // rPr layers below the run itself: paragraph style chain, then document defaults.
  runLayers: unknown[];
  styles: Record<string, any>;
  inheritedColor: string | undefined;
  inheritedFormatting: RunFormatting;
  defaultColor: string;
};

function buildRuns(paragraph: Record<string, unknown>, context: ParagraphContext): DocxRun[] {
  const raw = asArray(paragraph["w:r"] as Record<string, unknown> | Record<string, unknown>[] | undefined).map((run) => {
    const color = getRunColor(run) ?? context.inheritedColor;
    const formatting = mergeFormatting(
      formattingFromRpr(run["w:rPr"]),
      formattingFromRpr(findStyleRpr(context.styles, getRunStyleId(run))),
      context.inheritedFormatting
    );
    const layers = [run["w:rPr"], ...styleChain(context.index, getRunStyleId(run), false).map((style) => style["w:rPr"]), ...context.runLayers];
    return {
      text: textFromNode(run),
      fontFamily: resolveFontFamily(layers, context.theme),
      fontSize: resolveFontSize(layers),
      color: color && color !== context.defaultColor ? color : undefined,
      bold: formatting.bold || undefined,
      italic: formatting.italic || undefined,
      underline: formatting.underline || undefined
    };
  });
  return collapseRuns(raw);
}

function getParagraphMarkFont(paragraph: Record<string, unknown>): string | undefined {
  const pPr = paragraph["w:pPr"] as Record<string, unknown> | undefined;
  const rPr = pPr?.["w:rPr"] as Record<string, unknown> | undefined;
  const fonts = rPr?.["w:rFonts"] as Record<string, unknown> | undefined;
  const value = fonts?.["@_w:ascii"] ?? fonts?.["@_w:hAnsi"] ?? fonts?.["@_w:cs"] ?? fonts?.["@_w:eastAsia"];
  return typeof value === "string" ? value : undefined;
}

function readStyles(zip: AdmZip): Record<string, any> {
  const stylesEntry = zip.getEntry("word/styles.xml");
  if (!stylesEntry) return {};
  return parser.parse(stylesEntry.getData().toString("utf8")) as Record<string, any>;
}

function readRelationships(zip: AdmZip): Record<string, string> {
  const relsEntry = zip.getEntry("word/_rels/document.xml.rels");
  if (!relsEntry) return {};
  const rels = parser.parse(relsEntry.getData().toString("utf8")) as Record<string, any>;
  const relationships = asArray(rels.Relationships?.Relationship);
  return Object.fromEntries(
    relationships
      .filter((rel) => typeof rel?.["@_Id"] === "string" && typeof rel?.["@_Target"] === "string")
      .map((rel) => {
        const target = String(rel["@_Target"]);
        const fullTarget = target.startsWith("word/") ? target : `word/${target}`;
        return [rel["@_Id"], normalizeZipPath(fullTarget)];
      })
  );
}

export function parseDocx(sourcePath: string): ParsedDocx {
  if (!sourcePath.toLowerCase().endsWith(".docx")) {
    throw new Error("The selected file is not a valid DOCX file.");
  }

  const zip = new AdmZip(sourcePath);
  const documentEntry = zip.getEntry("word/document.xml");
  if (!documentEntry) {
    throw new Error("The selected file is not a valid DOCX file.");
  }

  const rels = readRelationships(zip);
  const styles = readStyles(zip);
  const defaultFont = getNormalStyleFont(styles) ?? getDefaultFont(styles);
  const defaultColor = getDefaultColor(styles);
  const styleIndex = buildStyleIndex(styles);
  const theme = readTheme(zip);
  const autoHyphenation = readAutoHyphenation(zip);
  const docDefaultRpr = styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"];
  const docDefaultPpr = styles["w:styles"]?.["w:docDefaults"]?.["w:pPrDefault"]?.["w:pPr"];
  const defaultFormatting = formattingFromRpr(styles["w:styles"]?.["w:docDefaults"]?.["w:rPrDefault"]?.["w:rPr"]);
  const document = parser.parse(documentEntry.getData().toString("utf8")) as Record<string, any>;
  const body = document["w:document"]?.["w:body"];
  const blocks: DocxBlock[] = [];

  for (const paragraph of asArray<Record<string, unknown>>(body?.["w:p"])) {
    const imageIds = [...findRelationshipIds(paragraph)].filter((id) => rels[id]?.startsWith("word/media/"));
    for (const relationshipId of imageIds) {
      blocks.push({
        type: "image",
        relationshipId,
        filename: rels[relationshipId]
      });
    }

    const level = getHeadingLevel(paragraph);
    const styleId = getParagraphStyleId(paragraph);
    const inheritedColor = getParagraphMarkColor(paragraph) ?? getStyleColor(styles, styleId);
    const inheritedFormatting = mergeFormatting(
      formattingFromRpr((paragraph["w:pPr"] as Record<string, unknown> | undefined)?.["w:rPr"]),
      formattingFromRpr(findStyleRpr(styles, styleId)),
      defaultFormatting
    );
    const paragraphStyles = styleChain(styleIndex, styleId, true);
    const runLayers = [...paragraphStyles.map((style) => style["w:rPr"]), docDefaultRpr];
    const paragraphLayers = [paragraph["w:pPr"], ...paragraphStyles.map((style) => style["w:pPr"]), docDefaultPpr];
    const runs = buildRuns(paragraph, { index: styleIndex, theme, runLayers, styles, inheritedColor, inheritedFormatting, defaultColor });
    const align = resolveAlign(paragraphLayers);
    const hyphens = autoHyphenation && !resolveSuppressHyphens(paragraphLayers);
    const text = runs.map((run) => run.text).join("");
    if (!text) continue;
    const fontFamily = getRunFont(paragraph["w:r"]) ?? getParagraphMarkFont(paragraph) ?? getStyleFont(styles, styleId) ?? defaultFont;
    blocks.push(
      level
        ? { type: "heading", level, text, fontFamily, runs, align, hyphens }
        : { type: "paragraph", text, fontFamily, runs, align, hyphens }
    );
  }

  const stats = fs.statSync(sourcePath);
  const imageMap = Object.fromEntries(
    Object.values(rels)
      .filter((target) => target.startsWith("word/media/"))
      .map((target) => [target, target])
  );

  return {
    sourcePath,
    filename: path.basename(sourcePath),
    size: stats.size,
    blocks,
    summary: {
      paragraphs: blocks.filter((block) => block.type === "paragraph").length,
      headings: blocks.filter((block) => block.type === "heading").length,
      images: blocks.filter((block) => block.type === "image").length
    },
    imageMap
  };
}
