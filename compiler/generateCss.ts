import type { EmbeddedFont } from "./fonts.js";
import { fontFaceCss } from "./fonts.js";
import { colorClassName } from "./utils.js";

type CssOptions = {
  fonts?: EmbeddedFont[];
  bodyFamily?: string;
  headingFamily?: string;
  textColors?: string[];
};

function stack(primary: string, fallback: string) {
  return `"${primary}", ${fallback}`;
}

function textColorCss(colors: string[]): string {
  if (colors.length === 0) return "";
  const rules = colors.map((hex) => `.${colorClassName(hex)} {\n  color: #${hex};\n}`).join("\n\n");
  return `\n\n/* Text colors carried over from the source DOCX. */\n${rules}\n`;
}

export function generateCss(options: CssOptions = {}): string {
  const bodyFamily = options.bodyFamily ?? "Inter";
  const headingFamily = options.headingFamily ?? "Constantia";
  const fontFaces = options.fonts?.length ? `${fontFaceCss(options.fonts)}\n\n` : "";
  const textColors = textColorCss(options.textColors ?? []);

  return `${fontFaces}body {
  color: #1f2933;
  font-family: ${stack(bodyFamily, '"Inter", "Noto Sans", "Segoe UI", Arial, sans-serif')};
  line-height: 1.65;
  margin: 0;
  padding: 1em 5%;
}

h1 {
  font-family: ${stack(headingFamily, '"Constantia", Georgia, serif')};
  font-size: 1.6em;
  line-height: 1.25;
  text-align: center;
}

p {
  margin: 0 0 1em;
}

.underline {
  text-decoration: underline;
}

.chapter {
  max-width: 42em;
  margin: 0 auto;
}

.section-title-page {
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.section-title-page h1 {
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.toc-page {
  padding: 1em 5%;
  font-family: "Inter", "Noto Sans", "Segoe UI", Arial, sans-serif;
}

.toc-title {
  text-align: center;
  font-size: 1.6em;
  font-weight: bold;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 1.5em;
  padding-bottom: 0.5em;
  border-bottom: 2px solid #dee2e6;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-list li {
  margin: 0;
  padding: 0;
  border-bottom: 1px solid #eee;
}

.toc-list li a {
  display: block;
  padding: 0.8em 0.5em;
  text-decoration: none;
  color: inherit;
  font-size: 1em;
}

.inline-illustration {
  break-before: page;
  break-after: page;
  page-break-before: always;
  page-break-after: always;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
}

.inline-illustration img {
  max-width: 100%;
  max-height: 100vh;
  width: auto;
  height: auto;
  object-fit: contain;
}

html,
body.image-page {
  margin: 0;
  padding: 0;
  height: 100%;
}

.full-page-image {
  height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  page-break-before: always;
  page-break-after: always;
}

.full-page-image img {
  max-width: 100%;
  max-height: 100vh;
  width: auto;
  height: auto;
  object-fit: contain;
}
${textColors}`;
}
