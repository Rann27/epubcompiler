import { useBookStore } from "../stores/bookStore";
import MetadataPresets from "../components/MetadataPresets";
import { useT } from "../i18n";
import { languageOptions, normalizeLang } from "../i18n/epub";
import type { UiKey } from "../i18n/ui";
import type { BookMetadata } from "../types/book";

const fields: { key: keyof BookMetadata; label: UiKey; textarea?: boolean }[] = [
  { key: "title", label: "metadata.title" },
  { key: "author", label: "metadata.author" },
  { key: "translator", label: "metadata.translator" },
  { key: "language", label: "metadata.language" },
  { key: "publisher", label: "metadata.publisher" },
  { key: "series", label: "metadata.series" },
  { key: "volume", label: "metadata.volume" },
  { key: "description", label: "metadata.description", textarea: true }
];

export default function MetadataPage() {
  const t = useT();
  const metadata = useBookStore((state) => state.metadata);
  const updateMetadata = useBookStore((state) => state.updateMetadata);
  if (!metadata) return null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-5">
    <section className="panel max-w-3xl p-5">
      <div className="grid gap-4">
        {fields.map((field) => (
          <label key={field.key} className="grid grid-cols-[170px_minmax(0,1fr)] items-start gap-4 text-sm">
            <span className="pt-2 font-semibold text-stone-700">{t(field.label)}</span>
            {field.key === "language" ? (
              <div>
                <select className="field" value={normalizeLang(metadata.language)} onChange={(event) => updateMetadata({ language: event.target.value })}>
                  {languageOptions.map((option) => <option key={option.code} value={option.code}>{option.label} ({option.code})</option>)}
                </select>
                <p className="mt-1 text-xs text-stone-500">{t("metadata.languageHint")}</p>
              </div>
            ) : field.textarea ? (
              <textarea className="field min-h-28 resize-y" value={metadata[field.key]} onChange={(event) => updateMetadata({ [field.key]: event.target.value })} />
            ) : (
              <input className="field" value={metadata[field.key]} onChange={(event) => updateMetadata({ [field.key]: event.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 rounded bg-stone-100 p-4 text-xs text-stone-600">
        <div><b>UUID</b><br />{metadata.uuid}</div>
        <div><b>{t("metadata.date")}</b><br />{metadata.date}</div>
        <div><b>{t("metadata.modified")}</b><br />{metadata.modified}</div>
      </div>
    </section>
    <MetadataPresets />
    </div>
  );
}
