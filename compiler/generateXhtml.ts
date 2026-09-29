import path from "node:path";
import type { BookSection, DocxBlock, DocxRun } from "../src/types/book.js";
import { colorClassName, escapeXml } from "./utils.js";

type InlineContent = { html: string; className?: string };

// Wraps a run in its emphasis markup, innermost first. Bold and italic use the
// semantic elements readers understand; underline has no semantic equivalent, so it
// gets a class the stylesheet defines.
function renderRun(run: DocxRun, hoistedColor: boolean): string {
  let html = escapeXml(run.text);
  if (run.underline) html = `<span class="underline">${html}</span>`;
  if (run.italic) html = `<em>${html}</em>`;
  if (run.bold) html = `<strong>${html}</strong>`;
  if (run.color && !hoistedColor) html = `<span class="${colorClassName(run.color)}">${html}</span>`;
  return html;
}

// Renders a block's text, carrying per-run color and emphasis over. When every run
// shares one color the class is hoisted onto the block element, so a uniformly
// colored paragraph needs no wrapper span.
function renderInline(block: { text: string; runs?: DocxRun[] }): InlineContent {
  const runs = block.runs;
  if (!runs?.length) return { html: escapeXml(block.text) };

  const uniformColor = runs.every((run) => run.color === runs[0].color);
  const hoisted = uniformColor && runs[0].color;
  const html = runs.map((run) => renderRun(run, uniformColor)).join("");
  return { html, className: hoisted ? colorClassName(hoisted) : undefined };
}

function classAttr(className: string | undefined): string {
  return className ? ` class="${className}"` : "";
}

function renderBlock(block: DocxBlock): string {
  if (block.type === "heading") {
    const level = Math.min(Math.max(block.level, 1), 6);
    const { html, className } = renderInline(block);
    return `<h${level}${classAttr(className)}>${html}</h${level}>`;
  }
  if (block.type === "paragraph") {
    const { html, className } = renderInline(block);
    return `<p${classAttr(className)}>${html}</p>`;
  }
  if (block.type === "image" && block.outputName) {
    return `<div class="inline-illustration"><img src="../images/${escapeXml(block.outputName)}" alt="Illustration" /></div>`;
  }
  return "";
}

function stylesheetHref(section: BookSection): string {
  return section.href === "nav.xhtml" ? "css/style.css" : "../css/style.css";
}

function imageSrc(section: BookSection): string {
  return `../images/${section.image?.outputName ?? "cover.webp"}`;
}

export function generateSectionXhtml(section: BookSection): string {
  const title = escapeXml(section.title);
  const style = stylesheetHref(section);

  if (section.type === "cover" || section.type === "image") {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="id" xml:lang="id">
<head>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="${style}" />
</head>
<body class="image-page">
  <div class="full-page-image">
    <img src="${imageSrc(section)}" alt="${escapeXml(section.image?.alt ?? section.title)}" />
  </div>
</body>
</html>`;
  }

  if (section.type === "illustration-opener") {
    return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="id" xml:lang="id">
<head>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="${style}" />
</head>
<body>
  <section class="section-title-page">
    <h1>${title}</h1>
  </section>
</body>
</html>`;
  }

  const body = section.sourceBlocks.map(renderBlock).filter(Boolean).join("\n    ");
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="id" xml:lang="id">
<head>
  <title>${title}</title>
  <link rel="stylesheet" type="text/css" href="${style}" />
</head>
<body>
  <section class="chapter">
    ${body || `<h1>${title}</h1>`}
  </section>
</body>
</html>`;
}

export function collectTextColors(sections: BookSection[]): string[] {
  const colors = new Set<string>();
  for (const section of sections) {
    for (const block of section.sourceBlocks) {
      if (block.type === "image") continue;
      for (const run of block.runs ?? []) {
        if (run.color) colors.add(run.color);
      }
    }
  }
  return [...colors].sort();
}

export function manifestId(section: BookSection): string {
  if (section.type === "toc") return "nav";
  return path.posix.basename(section.href, ".xhtml");
}
