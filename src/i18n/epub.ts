// Strings the compiler itself writes into the EPUB (not user content).
// Pure module: shared by the Electron main process, the compiler and the renderer.

export type LangCode = "en" | "id";

export const languageOptions: { code: LangCode; label: string }[] = [
  { code: "id", label: "Bahasa Indonesia" },
  { code: "en", label: "English" }
];

export type EpubStrings = {
  toc: string;
  illustrations: string;
  cover: string;
  illustration: (n: number | string) => string;
  illustrationAlt: string;
  frontMatter: string;
  opener: string;
};

export const epubStrings: Record<LangCode, EpubStrings> = {
  en: {
    toc: "Table of Contents",
    illustrations: "Illustrations",
    cover: "Cover",
    illustration: (n) => `Illustration ${n}`,
    illustrationAlt: "Illustration",
    frontMatter: "Front Matter",
    opener: "Opener Page"
  },
  id: {
    toc: "Daftar Isi",
    illustrations: "Ilustrasi",
    cover: "Sampul",
    illustration: (n) => `Ilustrasi ${n}`,
    illustrationAlt: "Ilustrasi",
    frontMatter: "Bagian Awal",
    opener: "Halaman Pembuka"
  }
};

export function normalizeLang(code: string | undefined | null): LangCode {
  const base = (code ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return base === "en" ? "en" : "id";
}

export function epubText(code: string | undefined | null): EpubStrings {
  return epubStrings[normalizeLang(code)];
}

// If `title` is one of the compiler's own default titles (in any language),
// return it translated to `code`; otherwise return it untouched so titles the
// user typed by hand are never overwritten.
export function retitle(title: string, code: string): string {
  const target = epubText(code);
  const trimmed = title.trim();
  for (const lang of Object.values(epubStrings)) {
    if (trimmed === lang.toc) return target.toc;
    if (trimmed === lang.illustrations) return target.illustrations;
    if (trimmed === lang.cover) return target.cover;
    if (trimmed === lang.frontMatter) return target.frontMatter;
    if (trimmed === lang.opener) return target.opener;
    if (trimmed === lang.illustrationAlt) return target.illustrationAlt;
    const match = /^(\d+)$/.exec(trimmed.slice(lang.illustration("").length));
    if (match && trimmed.startsWith(lang.illustration(""))) return target.illustration(match[1]);
  }
  return title;
}
