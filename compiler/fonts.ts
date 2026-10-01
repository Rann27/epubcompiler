import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { BookSection, FontStatus } from "../src/types/book.js";
import { buildStylePlan, collectRunFamilies } from "./stylePlan.js";

type FontRole = FontStatus["role"];

export type EmbeddedFont = {
  family: string;
  role: FontRole;
  sourcePath: string;
  outputName: string;
  fontStyle: "normal" | "italic";
  fontWeight: "normal" | "bold";
  mediaType: string;
};

export type FontEmbeddingResult = {
  fonts: EmbeddedFont[];
  statuses: FontStatus[];
  bodyFamily: string;
  headingFamily: string;
};

type RegistryFont = {
  displayName: string;
  fileName: string;
};

const COMPILER_BODY_FALLBACK = "Inter";
const COMPILER_HEADING_FALLBACK = "Constantia";

function cleanFontName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/g, "").replace(/\s+/g, " ").trim();
}

function normalize(value: string): string {
  return cleanFontName(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fontExt(file: string): string {
  return path.extname(file).toLowerCase();
}

function mediaTypeForFont(file: string): string {
  const ext = fontExt(file);
  if (ext === ".otf") return "font/otf";
  if (ext === ".woff") return "font/woff";
  if (ext === ".woff2") return "font/woff2";
  return "font/ttf";
}

function fontStyle(displayName: string, fileName: string): "normal" | "italic" {
  return /italic|oblique/i.test(`${displayName} ${fileName}`) ? "italic" : "normal";
}

function fontWeight(displayName: string, fileName: string): "normal" | "bold" {
  return /bold|black|semibold|demibold|heavy/i.test(`${displayName} ${fileName}`) ? "bold" : "normal";
}

function baseFamilyName(displayName: string): string {
  return cleanFontName(displayName)
    .replace(/\b(true ?type|open ?type|regular|normal|bold|italic|oblique|black|heavy|light|medium|semibold|demibold|thin|condensed|semicondensed|expanded)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFontFileName(family: string, sourcePath: string, style: string, weight: string): string {
  const base = cleanFontName(family).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "font";
  const ext = fontExt(sourcePath) || ".ttf";
  return `${base}-${weight}-${style}${ext}`.toLowerCase();
}

function windowsFontDirs(): string[] {
  const dirs = [path.join(process.env.WINDIR ?? "C:\\Windows", "Fonts")];
  const localFonts = path.join(os.homedir(), "AppData", "Local", "Microsoft", "Windows", "Fonts");
  if (fs.existsSync(localFonts)) dirs.push(localFonts);
  return dirs;
}

function readRegistryFonts(): RegistryFont[] {
  if (process.platform !== "win32") return [];
  const keys = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
    "HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"
  ];
  const fonts: RegistryFont[] = [];
  for (const key of keys) {
    try {
      const output = execFileSync("reg", ["query", key], { encoding: "utf8", windowsHide: true });
      for (const line of output.split(/\r?\n/)) {
        const match = line.match(/^\s*(.+?)\s+REG_\w+\s+(.+?)\s*$/);
        if (!match) continue;
        fonts.push({ displayName: cleanFontName(match[1]), fileName: match[2].trim() });
      }
    } catch {
      // Registry access is best-effort; filesystem scan below still provides fallback.
    }
  }
  return fonts;
}

function resolveFontPath(fileName: string): string | null {
  if (path.isAbsolute(fileName) && fs.existsSync(fileName)) return fileName;
  for (const dir of windowsFontDirs()) {
    const candidate = path.join(dir, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function scanFilesystemFonts(): RegistryFont[] {
  const fonts: RegistryFont[] = [];
  for (const dir of windowsFontDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!/\.(ttf|otf|woff2?|ttc)$/i.test(entry)) continue;
      fonts.push({ displayName: path.basename(entry, path.extname(entry)), fileName: entry });
    }
  }
  return fonts;
}

function allSystemFonts(): RegistryFont[] {
  const byFile = new Map<string, RegistryFont>();
  for (const item of [...readRegistryFonts(), ...scanFilesystemFonts()]) {
    const resolved = resolveFontPath(item.fileName);
    if (!resolved || fontExt(resolved) === ".ttc") continue;
    // Registry entries come first and carry the real family name; the folder scan only
    // knows the file name (e.g. "blkchcry" for BlackChancery), so it must not overwrite them.
    const key = resolved.toLowerCase();
    if (!byFile.has(key)) byFile.set(key, { ...item, fileName: resolved });
  }
  return [...byFile.values()];
}

function findFontFiles(family: string, systemFonts: RegistryFont[]): RegistryFont[] {
  const wanted = normalize(family);
  const exact = systemFonts.filter((font) => normalize(baseFamilyName(font.displayName)) === wanted);
  if (exact.length > 0) return exact;
  return systemFonts.filter((font) => normalize(path.basename(font.fileName, path.extname(font.fileName))).startsWith(wanted));
}

function preferredVariants(matches: RegistryFont[]): RegistryFont[] {
  const slots = new Map<string, RegistryFont>();
  for (const match of matches) {
    const style = fontStyle(match.displayName, match.fileName);
    const weight = fontWeight(match.displayName, match.fileName);
    const key = `${weight}-${style}`;
    const current = slots.get(key);
    if (!current || scoreVariant(match) > scoreVariant(current)) {
      slots.set(key, match);
    }
  }
  return ["normal-normal", "bold-normal", "normal-italic", "bold-italic"]
    .map((key) => slots.get(key))
    .filter((font): font is RegistryFont => Boolean(font));
}

function scoreVariant(font: RegistryFont): number {
  const name = `${font.displayName} ${path.basename(font.fileName)}`;
  let score = 0;
  if (/\bregular\b/i.test(name)) score += 4;
  if (/\bbold\b/i.test(name)) score += 4;
  if (/\bitalic\b/i.test(name)) score += 4;
  if (!/condensed|display|extra|semi|light|thin|black|heavy/i.test(name)) score += 2;
  return score;
}

function choosePrimaryFont(fonts: EmbeddedFont[]): EmbeddedFont | undefined {
  return (
    fonts.find((font) => font.fontWeight === "normal" && font.fontStyle === "normal") ??
    fonts.find((font) => font.fontStyle === "normal") ??
    fonts[0]
  );
}

export function getDocumentFontPlan(sections: BookSection[]) {
  const plan = buildStylePlan(sections);
  return {
    headingFamily: plan.headingFamily ?? COMPILER_HEADING_FALLBACK,
    bodyFamily: plan.bodyFamily ?? COMPILER_BODY_FALLBACK
  };
}

export function collectEmbeddedFonts(sections: BookSection[]): FontEmbeddingResult {
  const { headingFamily, bodyFamily } = getDocumentFontPlan(sections);
  const wanted: { family: string; role: FontRole }[] = [
    { family: bodyFamily, role: "body" },
    { family: headingFamily, role: "heading" }
  ];
  if (!wanted.some((item) => normalize(item.family) === normalize(COMPILER_BODY_FALLBACK))) {
    wanted.push({ family: COMPILER_BODY_FALLBACK, role: "fallback" });
  }

  // Fonts that individual runs ask for (e.g. a one-off heading in another face).
  const known = new Set(wanted.map((item) => normalize(item.family)));
  for (const family of collectRunFamilies(sections)) {
    if (known.has(normalize(family))) continue;
    known.add(normalize(family));
    wanted.push({ family, role: "custom" });
  }

  const systemFonts = allSystemFonts();
  const fonts: EmbeddedFont[] = [];
  const statuses: FontStatus[] = [];
  const usedOutputNames = new Set<string>();

  for (const item of wanted) {
    const matches = preferredVariants(findFontFiles(item.family, systemFonts));
    const embeddedForFamily: EmbeddedFont[] = [];
    for (const match of matches) {
      const sourcePath = match.fileName;
      const style = fontStyle(match.displayName, sourcePath);
      const weight = fontWeight(match.displayName, sourcePath);
      let outputName = safeFontFileName(item.family, sourcePath, style, weight);
      let count = 2;
      while (usedOutputNames.has(outputName)) {
        outputName = outputName.replace(/(\.[^.]+)$/, `-${count}$1`);
        count += 1;
      }
      usedOutputNames.add(outputName);
      embeddedForFamily.push({
        family: cleanFontName(item.family),
        role: item.role,
        sourcePath,
        outputName,
        fontStyle: style,
        fontWeight: weight,
        mediaType: mediaTypeForFont(sourcePath)
      });
    }
    fonts.push(...embeddedForFamily);
    statuses.push({
      family: cleanFontName(item.family),
      role: item.role,
      found: embeddedForFamily.length > 0,
      embeddedFiles: embeddedForFamily.map((font) => font.outputName),
      message:
        embeddedForFamily.length > 0
          ? `${cleanFontName(item.family)} found and embedded`
          : `${cleanFontName(item.family)} was not found; fallback will be used`
    });
  }

  return {
    fonts,
    statuses,
    bodyFamily: cleanFontName(bodyFamily),
    headingFamily: cleanFontName(headingFamily)
  };
}

export function fontFaceCss(fonts: EmbeddedFont[]): string {
  return fonts
    .map(
      (font) => `@font-face {
  font-family: "${font.family}";
  src: url("../fonts/${font.outputName}");
  font-style: ${font.fontStyle};
  font-weight: ${font.fontWeight};
}`
    )
    .join("\n\n");
}
