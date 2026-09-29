import type { BookSection } from "../src/types/book.js";
import { escapeXml, sortByOrder } from "./utils.js";

function hrefFromNav(href: string): string {
  return href === "nav.xhtml" ? "nav.xhtml" : href;
}

export function generateNav(sections: BookSection[], title = "Table of Contents"): string {
  const items = sortByOrder(sections)
    .filter((section) => section.includeInToc)
    .map((section) => `      <li><a href="${escapeXml(hrefFromNav(section.href))}">${escapeXml(section.title)}</a></li>`)
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="id" xml:lang="id">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css" />
</head>
<body>
  <nav epub:type="toc" id="toc" class="toc-page">
    <h1 class="toc-title">${escapeXml(title)}</h1>
    <ol class="toc-list">
${items}
    </ol>
  </nav>
</body>
</html>`;
}
