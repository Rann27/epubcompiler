import type { BookMetadata, BookSection } from "../src/types/book.js";
import type { EmbeddedFont } from "./fonts.js";
import { escapeXml, mediaTypeForImage, sortByOrder } from "./utils.js";
import { manifestId } from "./generateXhtml.js";

export function generateOpf(metadata: BookMetadata, sections: BookSection[], fonts: EmbeddedFont[] = []): string {
  const spineSections = sortByOrder(sections).filter((section) => section.includeInSpine);
  const xhtmlItems = sortByOrder(sections)
    .filter((section) => section.includeInSpine || section.type === "toc")
    .map((section) => {
      const id = manifestId(section);
      const properties = section.type === "toc" ? ' properties="nav"' : "";
      return `    <item id="${escapeXml(id)}" href="${escapeXml(section.href)}" media-type="application/xhtml+xml"${properties}/>`;
    })
    .join("\n");

  const imageItems = sortByOrder(sections)
    .filter((section) => section.image)
    .map((section) => {
      const id = `${manifestId(section)}-image`;
      const properties = section.type === "cover" ? ' properties="cover-image"' : "";
      const mediaType = mediaTypeForImage(section.image!.outputName);
      return `    <item id="${escapeXml(id)}" href="images/${escapeXml(section.image!.outputName)}" media-type="${mediaType}"${properties}/>`;
    })
    .join("\n");

  const seenImageNames = new Set(sections.filter((s) => s.image).map((s) => s.image!.outputName));
  const embeddedImageItems = sections
    .flatMap((s) => s.sourceBlocks.filter((b): b is Extract<typeof b, { type: "image" }> => b.type === "image" && !!b.outputName && !seenImageNames.has(b.outputName!)))
    .filter((b, i, arr) => arr.findIndex((x) => x.outputName === b.outputName) === i)
    .map((b) => {
      const id = `embedded-${escapeXml(b.outputName!.replace(/\.[^.]+$/, ""))}`;
      return `    <item id="${id}" href="images/${escapeXml(b.outputName!)}" media-type="${mediaTypeForImage(b.outputName!)}"/>`;
    })
    .join("\n");

  const fontItems = fonts
    .map(
      (font) =>
        `    <item id="font-${escapeXml(font.outputName.replace(/[^a-z0-9]+/gi, "-"))}" href="fonts/${escapeXml(font.outputName)}" media-type="${font.mediaType}"/>`
    )
    .join("\n");

  const spineItems = spineSections
    .map((section) => {
      const linear = !section.linear ? ' linear="no"' : "";
      return `    <itemref idref="${escapeXml(manifestId(section))}"${linear}/>`;
    })
    .join("\n");

  const contributor = metadata.translator
    ? `    <dc:contributor id="translator">${escapeXml(metadata.translator)}</dc:contributor>\n`
    : "";
  const publisher = metadata.publisher ? `    <dc:publisher>${escapeXml(metadata.publisher)}</dc:publisher>\n` : "";
  const description = metadata.description
    ? `    <dc:description>${escapeXml(metadata.description)}</dc:description>\n`
    : "";
  const series = metadata.series ? `    <meta property="belongs-to-collection">${escapeXml(metadata.series)}</meta>\n` : "";
  const volume = metadata.volume ? `    <meta property="group-position">${escapeXml(metadata.volume)}</meta>\n` : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${escapeXml(metadata.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(metadata.title)}</dc:title>
    <dc:creator>${escapeXml(metadata.author || "Unknown")}</dc:creator>
    <dc:language>${escapeXml(metadata.language)}</dc:language>
    <dc:identifier id="pub-id">urn:uuid:${escapeXml(metadata.uuid)}</dc:identifier>
    <dc:date>${escapeXml(metadata.date)}</dc:date>
${contributor}${publisher}${description}${series}${volume}    <meta property="dcterms:modified">${escapeXml(metadata.modified)}</meta>
  </metadata>
  <manifest>
    <item id="style" href="css/style.css" media-type="text/css"/>
${xhtmlItems}
${imageItems}
${embeddedImageItems ? embeddedImageItems + "\n" : ""}${fontItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`;
}
