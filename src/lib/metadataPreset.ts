import { normalizeLang } from "../i18n/epub";
import type { MetadataPreset, PresetFields, PresetKey } from "../types/book";

// Fields a preset may carry. uuid/date/modified are per-build and never part of one.
export const presetKeys: PresetKey[] = ["title", "author", "translator", "language", "publisher", "series", "volume", "description"];

const FORMAT = "epubcompiler-metadata-preset";

export class PresetFileError extends Error {
  constructor(public code: "invalid" | "empty") {
    super(code);
  }
}

// Keeps only the known fields that actually hold a value; empty ones are skipped.
export function pickFilled(source: Record<string, unknown>): PresetFields {
  const fields: PresetFields = {};
  for (const key of presetKeys) {
    const value = source[key];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const text = String(value).trim();
    if (!text) continue;
    fields[key] = key === "language" ? normalizeLang(text) : text;
  }
  return fields;
}

export function nameFromFile(fileName: string): string {
  return fileName.replace(/\.json$/i, "").replace(/\.(epubcompiler|preset|epubcompiler-preset)$/i, "").trim() || "Preset";
}

// Accepts a preset file, a project config (`{ metadata: {...} }`) or a bare flat object.
export function parsePresetFile(text: string, fileName: string): MetadataPreset {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PresetFileError("invalid");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new PresetFileError("invalid");
  const object = data as Record<string, unknown>;
  const source = object.metadata && typeof object.metadata === "object" ? (object.metadata as Record<string, unknown>) : object;
  const fields = pickFilled(source);
  if (Object.keys(fields).length === 0) throw new PresetFileError("empty");
  const name = typeof object.name === "string" && object.name.trim() ? object.name.trim() : nameFromFile(fileName);
  return { name, fields };
}

export function serializePreset(preset: MetadataPreset): string {
  return JSON.stringify({ format: FORMAT, version: 1, name: preset.name, metadata: preset.fields }, null, 2);
}
