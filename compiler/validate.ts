import type { BookSection, CompileRequest } from "../src/types/book.js";

export function validateCompileRequest(request: CompileRequest): string[] {
  const errors: string[] = [];
  if (!request.metadata.title.trim()) errors.push("Please fill required metadata before compiling.");
  if (!request.metadata.language.trim()) errors.push("Please fill required metadata before compiling.");
  if (!request.sections.some((section) => section.type === "chapter" || section.type === "extra" || section.type === "about")) {
    errors.push("No readable content was found in this DOCX.");
  }
  const hrefs = request.sections.map((section) => section.href);
  if (new Set(hrefs).size !== hrefs.length) errors.push("All section filenames must be unique.");
  if (!request.sections.some((section) => section.type === "toc" && section.id === "nav")) {
    errors.push("nav.xhtml must be present in the EPUB.");
  }
  return [...new Set(errors)];
}

export function normalizeSectionOrder(sections: BookSection[]): BookSection[] {
  return [...sections].sort((a, b) => a.order - b.order).map((section, order) => ({ ...section, order }));
}
