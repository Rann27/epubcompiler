import path from "node:path";

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

// Word writes colors as bare 6-digit hex ("FF0000"), sometimes as "auto" to mean
// "let the reader decide". Returns lowercase 6-digit hex, or undefined when the
// value carries no usable color.
export function normalizeHexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim().replace(/^#/, "").toLowerCase();
  if (!raw || raw === "auto") return undefined;
  if (/^[0-9a-f]{3}$/.test(raw)) return raw.split("").map((char) => char + char).join("");
  return /^[0-9a-f]{6}$/.test(raw) ? raw : undefined;
}

export function colorClassName(hex: string): string {
  return `text-${hex}`;
}

export function normalizeZipPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

// GIFs are copied into the EPUB byte-for-byte. Re-encoding one through sharp would
// read only its first frame and flatten any animation, and GIF remains the most
// widely supported animated format in readers. Everything else becomes WebP.
export function keepsOriginalImageFormat(sourceFile: string): boolean {
  return path.extname(sourceFile).toLowerCase() === ".gif";
}

export function imageOutputExtension(sourceFile: string): string {
  return keepsOriginalImageFormat(sourceFile) ? ".gif" : ".webp";
}

export function mediaTypeForImage(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

export function uniqueHref(base: string, used: Set<string>): string {
  const parsed = path.posix.parse(base);
  let candidate = base;
  let count = 2;
  while (used.has(candidate)) {
    candidate = `${parsed.dir ? `${parsed.dir}/` : ""}${parsed.name}-${count}${parsed.ext}`;
    count += 1;
  }
  used.add(candidate);
  return candidate;
}

export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}
