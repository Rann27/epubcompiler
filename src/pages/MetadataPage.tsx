import { useBookStore } from "../stores/bookStore";
import type { BookMetadata } from "../types/book";

const fields: { key: keyof BookMetadata; label: string; textarea?: boolean }[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "translator", label: "Translator" },
  { key: "language", label: "Language" },
  { key: "publisher", label: "Publisher / Group" },
  { key: "series", label: "Series name" },
  { key: "volume", label: "Volume number" },
  { key: "description", label: "Description", textarea: true }
];

export default function MetadataPage() {
  const metadata = useBookStore((state) => state.metadata);
  const updateMetadata = useBookStore((state) => state.updateMetadata);
  if (!metadata) return null;

  return (
    <section className="panel max-w-3xl p-5">
      <div className="grid gap-4">
        {fields.map((field) => (
          <label key={field.key} className="grid grid-cols-[170px_minmax(0,1fr)] items-start gap-4 text-sm">
            <span className="pt-2 font-semibold text-stone-700">{field.label}</span>
            {field.textarea ? (
              <textarea className="field min-h-28 resize-y" value={metadata[field.key]} onChange={(event) => updateMetadata({ [field.key]: event.target.value })} />
            ) : (
              <input className="field" value={metadata[field.key]} onChange={(event) => updateMetadata({ [field.key]: event.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 rounded bg-stone-100 p-4 text-xs text-stone-600">
        <div><b>UUID</b><br />{metadata.uuid}</div>
        <div><b>Date</b><br />{metadata.date}</div>
        <div><b>Modified</b><br />{metadata.modified}</div>
      </div>
    </section>
  );
}
