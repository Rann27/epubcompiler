import AdmZip from "adm-zip";
import sharp from "sharp";
import type { BookSection } from "../src/types/book.js";
import { keepsOriginalImageFormat } from "./utils.js";

export async function processImages(sourceDocx: string, sections: BookSection[], quality: number): Promise<Map<string, Buffer>> {
  const zip = new AdmZip(sourceDocx);
  const images = new Map<string, Buffer>();

  const convert = async (sourcePath: string, outputName: string) => {
    if (images.has(outputName)) return;
    const entry = zip.getEntry(sourcePath);
    if (!entry) throw new Error("Some images could not be extracted from the DOCX.");
    const data = entry.getData();
    images.set(outputName, keepsOriginalImageFormat(sourcePath) ? data : await sharp(data).webp({ quality }).toBuffer());
  };

  for (const section of sections.filter((item) => item.image)) {
    await convert(section.image!.sourcePath, section.image!.outputName);
  }

  for (const section of sections) {
    for (const block of section.sourceBlocks) {
      if (block.type === "image" && block.outputName) {
        await convert(block.filename, block.outputName);
      }
    }
  }

  return images;
}
