import type { BookSection, DocxBlock, DocxRun, TextAlign } from "../src/types/book.js";
import { slugify, sortByOrder } from "./utils.js";

type TextBlock = Extract<DocxBlock, { type: "heading" | "paragraph" }>;

// The document's "normal" look: the most common font, size, alignment and
// hyphenation for body text and for each heading level. These become the
// stylesheet defaults, and anything that differs from them (a heading with its
// own font, a centered paragraph, ...) is emitted as a small override class
// instead of being flattened to the default.
export type StylePlan = {
  bodyFamily?: string;
  headingFamily?: string;
  bodySize?: number;
  headingSize: Record<number, number>;
  bodyAlign?: TextAlign;
  headingAlign: Record<number, TextAlign>;
  // Hyphenation applies to body text only: auto-hyphenated centered headings read badly.
  bodyHyphens?: boolean;
};

// Class name -> CSS rule, filled in while blocks are rendered.
export type StyleRegistry = Map<string, string>;

export function emptyPlan(): StylePlan {
  return { headingSize: {}, headingAlign: {} };
}

export function normalizeFamily(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function headingLevel(block: TextBlock): number {
  return block.type === "heading" ? Math.min(Math.max(block.level, 1), 6) : 0;
}

function textBlocks(sections: BookSection[]): TextBlock[] {
  return sortByOrder(sections)
    .flatMap((section) => section.sourceBlocks)
    .filter((block): block is TextBlock => block.type === "heading" || block.type === "paragraph");
}

function dominantRun(block: TextBlock): DocxRun | undefined {
  let best: DocxRun | undefined;
  for (const run of block.runs ?? []) {
    if (!best || run.text.length > best.text.length) best = run;
  }
  return best;
}

export function blockFamily(block: TextBlock): string | undefined {
  return dominantRun(block)?.fontFamily ?? block.fontFamily;
}

function majority<T>(values: (T | undefined)[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: T | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function buildStylePlan(sections: BookSection[]): StylePlan {
  const blocks = textBlocks(sections);
  const body = blocks.filter((block) => block.type === "paragraph");
  const headings = blocks.filter((block) => block.type === "heading");
  const plan = emptyPlan();

  plan.bodyFamily = majority(body.map(blockFamily));
  plan.headingFamily = majority(headings.map(blockFamily));
  plan.bodySize = majority(body.map((block) => dominantRun(block)?.fontSize));
  plan.bodyAlign = majority(body.map((block) => block.align));
  plan.bodyHyphens = majority(body.map((block) => block.hyphens));

  for (let level = 1; level <= 6; level += 1) {
    const atLevel = headings.filter((block) => headingLevel(block) === level);
    if (atLevel.length === 0) continue;
    const size = majority(atLevel.map((block) => dominantRun(block)?.fontSize));
    const align = majority(atLevel.map((block) => block.align));
    if (size !== undefined) plan.headingSize[level] = size;
    if (align !== undefined) plan.headingAlign[level] = align;
  }
  return plan;
}

// Every distinct font a run asks for, for embedding.
export function collectRunFamilies(sections: BookSection[]): string[] {
  const families = new Map<string, string>();
  for (const block of textBlocks(sections)) {
    for (const run of block.runs ?? []) {
      if (run.fontFamily && !families.has(normalizeFamily(run.fontFamily))) families.set(normalizeFamily(run.fontFamily), run.fontFamily);
    }
  }
  return [...families.values()];
}

function genericFamily(name: string): string {
  if (/mono|courier|consolas|code/i.test(name)) return "monospace";
  if (/chancery|script|hand/i.test(name)) return "cursive";
  if (/times|georgia|garamond|constantia|cambria|palatino|book|serif|minion|caslon|mincho/i.test(name) && !/sans/i.test(name)) return "serif";
  return "sans-serif";
}

export function fontStack(family: string): string {
  return `"${family}", ${genericFamily(family)}`;
}

function register(registry: StyleRegistry, className: string, rule: string): string {
  registry.set(className, `.${className} {\n  ${rule}\n}`);
  return className;
}

// Classes for properties that apply to the whole paragraph or heading.
export function blockClasses(block: TextBlock, plan: StylePlan, registry: StyleRegistry): string[] {
  const level = headingLevel(block);
  const classes: string[] = [];

  const baseAlign = level ? plan.headingAlign[level] : plan.bodyAlign;
  if (block.align && baseAlign && block.align !== baseAlign) {
    classes.push(register(registry, `ta-${block.align}`, `text-align: ${block.align};`));
  }

  const baseHyphens = level ? undefined : plan.bodyHyphens;
  if (block.hyphens !== undefined && baseHyphens !== undefined && block.hyphens !== baseHyphens) {
    classes.push(
      register(
        registry,
        block.hyphens ? "hy-on" : "hy-off",
        block.hyphens ? "hyphens: auto;\n  -webkit-hyphens: auto;\n  -epub-hyphens: auto;" : "hyphens: manual;\n  -webkit-hyphens: manual;\n  -epub-hyphens: manual;"
      )
    );
  }
  return classes;
}

// Classes for runs that differ from their block's baseline font or size. Sizes
// are percentages of the surrounding block, so they stay relative to whatever
// size the heading or paragraph itself resolves to.
export function runClasses(run: DocxRun, block: TextBlock, plan: StylePlan, registry: StyleRegistry): string[] {
  const level = headingLevel(block);
  const classes: string[] = [];

  const baseFamily = level ? plan.headingFamily : plan.bodyFamily;
  if (run.fontFamily && baseFamily && normalizeFamily(run.fontFamily) !== normalizeFamily(baseFamily)) {
    classes.push(register(registry, `ff-${slugify(run.fontFamily, "font")}`, `font-family: ${fontStack(run.fontFamily)};`));
  }

  const baseSize = level ? plan.headingSize[level] : plan.bodySize;
  if (run.fontSize && baseSize) {
    const percent = Math.round((run.fontSize / baseSize) * 100);
    if (percent !== 100) classes.push(register(registry, `fs-${percent}`, `font-size: ${percent}%;`));
  }
  return classes;
}

// Stylesheet rules for the plan itself. Emitted after the base rules so they win.
export function planCss(plan: StylePlan): string {
  const rules: string[] = [];

  const body: string[] = [];
  if (plan.bodyAlign) body.push(`text-align: ${plan.bodyAlign};`);
  if (plan.bodyHyphens) body.push("hyphens: auto;", "-webkit-hyphens: auto;", "-epub-hyphens: auto;");
  if (body.length) rules.push(`p {\n  ${body.join("\n  ")}\n}`);

  for (let level = 1; level <= 6; level += 1) {
    const lines: string[] = [];
    const size = plan.headingSize[level];
    if (size && plan.bodySize) lines.push(`font-size: ${Math.round((size / plan.bodySize) * 100) / 100}em;`);
    if (plan.headingAlign[level]) lines.push(`text-align: ${plan.headingAlign[level]};`);
    if (lines.length) rules.push(`h${level} {\n  ${lines.join("\n  ")}\n}`);
  }

  return rules.length ? `\n\n/* Typography carried over from the source DOCX. */\n${rules.join("\n\n")}\n` : "";
}
