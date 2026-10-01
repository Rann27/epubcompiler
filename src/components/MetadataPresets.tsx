import { ChevronDown, FileJson, FolderOpen, Save, Share2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import type { UiKey } from "../i18n/ui";
import { PresetFileError, parsePresetFile, pickFilled, presetKeys, serializePreset } from "../lib/metadataPreset";
import { useBookStore } from "../stores/bookStore";
import { usePresetStore } from "../stores/presetStore";
import type { MetadataPreset, PresetFields } from "../types/book";

const fieldLabel: Record<(typeof presetKeys)[number], UiKey> = {
  title: "metadata.title",
  author: "metadata.author",
  translator: "metadata.translator",
  language: "metadata.language",
  publisher: "metadata.publisher",
  series: "metadata.series",
  volume: "metadata.volume",
  description: "metadata.description"
};

// Per-book values that rarely belong in a reusable preset start unchecked.
const DEFAULT_EXCLUDED = new Set<string>(["title", "volume"]);

type Notice = { kind: "ok" | "error"; text: string };

export default function MetadataPresets() {
  const t = useT();
  const metadata = useBookStore((state) => state.metadata);
  const updateMetadata = useBookStore((state) => state.updateMetadata);
  const presets = usePresetStore((state) => state.presets);
  const loadPresets = usePresetStore((state) => state.load);
  const upsert = usePresetStore((state) => state.upsert);
  const remove = usePresetStore((state) => state.remove);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set(DEFAULT_EXCLUDED));
  const dropDepth = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const filled = useMemo(() => (metadata ? pickFilled(metadata as unknown as Record<string, unknown>) : {}), [metadata]);
  const chosen = presetKeys.filter((key) => filled[key] && !excluded.has(key));
  const chosenFields = (): PresetFields => Object.fromEntries(chosen.map((key) => [key, filled[key]])) as PresetFields;
  const nameExists = presets.some((preset) => preset.name.trim().toLowerCase() === name.trim().toLowerCase());

  const apply = (preset: MetadataPreset) => {
    updateMetadata(preset.fields);
    setSelected(preset.name);
  };

  const importFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".json")) return setNotice({ kind: "error", text: t("preset.errNotJson") });
    try {
      const parsed = parsePresetFile(await file.text(), file.name);
      const saved = await upsert(parsed.name, parsed.fields, "replace");
      apply(saved);
      setNotice({ kind: "ok", text: t("preset.loaded", { name: saved.name, count: Object.keys(saved.fields).length }) });
    } catch (error) {
      const empty = error instanceof PresetFileError && error.code === "empty";
      setNotice({ kind: "error", text: t(empty ? "preset.errEmpty" : "preset.errInvalid") });
    }
  };

  const savePreset = async () => {
    if (!name.trim()) return setNotice({ kind: "error", text: t("preset.nameRequired") });
    if (chosen.length === 0) return setNotice({ kind: "error", text: t("preset.nothing") });
    const saved = await upsert(name, chosenFields(), "merge");
    setSelected(saved.name);
    setNotice({ kind: "ok", text: t("preset.saved", { name: saved.name, count: chosen.length }) });
  };

  const exportFile = async () => {
    if (chosen.length === 0) return setNotice({ kind: "error", text: t("preset.nothing") });
    const fileName = name.trim() || "metadata";
    const target = await window.epubCompiler.exportPreset(fileName, serializePreset({ name: fileName, fields: chosenFields() }));
    if (target) setNotice({ kind: "ok", text: t("preset.exported", { path: target }) });
  };

  const toggle = (key: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <aside className="grid content-start gap-5">
      <section className="panel p-5">
        <h2 className="font-bold">{t("preset.title")}</h2>

        <div className="relative mt-4" ref={menuRef}>
          <button type="button" className="field flex items-center justify-between text-left" onClick={() => setOpen((value) => !value)}>
            <span className={`truncate ${selected ? "" : "text-stone-400"}`}>{selected || t("preset.select")}</span>
            <ChevronDown size={16} className="shrink-0 text-stone-500" />
          </button>
          {open && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded border border-stone-200 bg-white shadow-lg">
              {presets.length === 0 && <div className="p-3 text-xs text-stone-500">{t("preset.empty")}</div>}
              {presets.map((preset) => (
                <div key={preset.name} className="flex items-center border-b border-stone-100 last:border-0 hover:bg-teal-50">
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                    onClick={() => {
                      apply(preset);
                      setOpen(false);
                      setNotice({ kind: "ok", text: t("preset.applied", { name: preset.name, count: Object.keys(preset.fields).length }) });
                    }}
                  >
                    <div className="truncate font-semibold">{preset.name}</div>
                    <div className="truncate text-xs text-stone-500">
                      {t("preset.fields", { count: Object.keys(preset.fields).length })} ·{" "}
                      {presetKeys.filter((key) => preset.fields[key]).map((key) => t(fieldLabel[key])).join(", ")}
                    </div>
                  </button>
                  <button
                    type="button"
                    title={t("preset.delete")}
                    aria-label={t("preset.delete")}
                    className="px-3 py-3 text-stone-400 hover:text-red-600"
                    onClick={async () => {
                      if (!window.confirm(t("preset.deleteConfirm", { name: preset.name }))) return;
                      await remove(preset.name);
                      if (selected === preset.name) setSelected("");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`mt-3 flex flex-col items-center gap-2 rounded border-2 border-dashed px-3 py-5 text-center text-xs transition ${
            dragging ? "border-teal-500 bg-teal-50 text-teal-800" : "border-stone-300 text-stone-500"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            dropDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dropDepth.current = Math.max(0, dropDepth.current - 1);
            if (dropDepth.current === 0) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            dropDepth.current = 0;
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void importFile(file);
          }}
        >
          <FileJson size={22} />
          <span>{dragging ? t("preset.dropRelease") : t("preset.dropHere")}</span>
          <button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => fileInput.current?.click()}>
            <FolderOpen size={14} /> {t("preset.loadFile")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">{t("preset.saveTitle")}</h2>
        <p className="mt-1 text-xs text-stone-500">{t("preset.saveHint")}</p>

        <div className="mt-4 grid gap-1.5 text-sm">
          {presetKeys.map((key) => {
            const has = Boolean(filled[key]);
            return (
              <label key={key} className={`flex items-center gap-2 ${has ? "" : "text-stone-300"}`}>
                <input type="checkbox" disabled={!has} checked={has && !excluded.has(key)} onChange={() => toggle(key)} />
                <span className="min-w-0 flex-1 truncate">{t(fieldLabel[key])}</span>
              </label>
            );
          })}
        </div>

        <label className="mt-4 block text-sm">
          <span className="font-semibold text-stone-700">{t("preset.name")}</span>
          <input className="field mt-1" value={name} placeholder={t("preset.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
        </label>
        {nameExists && <p className="mt-1 text-xs text-amber-700">{t("preset.willUpdate")}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="button" onClick={() => void savePreset()}>
            <Save size={15} /> {t("preset.savePreset")}
          </button>
          <button type="button" className="button-secondary" onClick={() => void exportFile()}>
            <Share2 size={15} /> {t("preset.exportFile")}
          </button>
        </div>
      </section>

      {notice && (
        <div className={`break-words rounded px-3 py-2 text-xs ${notice.kind === "ok" ? "bg-teal-50 text-teal-900" : "bg-red-50 text-red-800"}`}>
          {notice.text}
        </div>
      )}
    </aside>
  );
}
